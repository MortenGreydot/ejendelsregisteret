<?php
/**
 * Statistics Class for Hittegodscentralen Users
 * Provides statistical analysis and reporting
 */

if (!defined('ABSPATH')) exit;

class HG_Statistics {

    /**
     * Get date range based on filter
     */
    public static function get_date_range($filter = '30days') {
        $end = current_time('mysql');

        switch ($filter) {
            case '7days':
                $start = date('Y-m-d H:i:s', strtotime('-7 days'));
                break;
            case '30days':
                $start = date('Y-m-d H:i:s', strtotime('-30 days'));
                break;
            case '3months':
                $start = date('Y-m-d H:i:s', strtotime('-3 months'));
                break;
            case '1year':
                $start = date('Y-m-d H:i:s', strtotime('-1 year'));
                break;
            case 'all':
            default:
                $start = '2000-01-01 00:00:00';
                break;
        }

        return ['start' => $start, 'end' => $end];
    }

    /**
     * Get top categories (most lost/found items)
     */
    public static function get_top_categories($limit = 10, $date_filter = '30days') {
        global $wpdb;

        $range = self::get_date_range($date_filter);

        $results = $wpdb->get_results($wpdb->prepare("
            SELECT t.term_id, t.name, t.slug, COUNT(tr.object_id) as count
            FROM {$wpdb->term_taxonomy} tt
            INNER JOIN {$wpdb->terms} t ON tt.term_id = t.term_id
            INNER JOIN {$wpdb->term_relationships} tr ON tt.term_taxonomy_id = tr.term_taxonomy_id
            INNER JOIN {$wpdb->posts} p ON tr.object_id = p.ID
            WHERE tt.taxonomy = 'product_cat'
            AND p.post_type = 'product'
            AND p.post_status = 'publish'
            AND p.post_date BETWEEN %s AND %s
            GROUP BY t.term_id
            ORDER BY count DESC
            LIMIT %d
        ", $range['start'], $range['end'], $limit));

        return $results;
    }

    /**
     * Get geographic statistics (by area)
     */
    public static function get_geographic_stats($limit = 15, $date_filter = '30days') {
        global $wpdb;

        $range = self::get_date_range($date_filter);

        $results = $wpdb->get_results($wpdb->prepare("
            SELECT pm.meta_value as area, COUNT(p.ID) as count
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'product'
            AND p.post_status = 'publish'
            AND pm.meta_key = '_lf_by_omraade'
            AND pm.meta_value != ''
            AND p.post_date BETWEEN %s AND %s
            GROUP BY pm.meta_value
            ORDER BY count DESC
            LIMIT %d
        ", $range['start'], $range['end'], $limit));

        return $results;
    }

    /**
     * Get posts by weekday
     */
    public static function get_posts_by_weekday($date_filter = '30days') {
        global $wpdb;

        $range = self::get_date_range($date_filter);

        $results = $wpdb->get_results($wpdb->prepare("
            SELECT DAYOFWEEK(post_date) as day_num, COUNT(*) as count
            FROM {$wpdb->posts}
            WHERE post_type = 'product'
            AND post_status = 'publish'
            AND post_date BETWEEN %s AND %s
            GROUP BY DAYOFWEEK(post_date)
            ORDER BY day_num
        ", $range['start'], $range['end']));

        // Map to Danish day names
        $day_names = [
            1 => 'Sondag',
            2 => 'Mandag',
            3 => 'Tirsdag',
            4 => 'Onsdag',
            5 => 'Torsdag',
            6 => 'Fredag',
            7 => 'Lordag'
        ];

        $formatted = [];
        foreach ($day_names as $num => $name) {
            $formatted[$name] = 0;
        }

        foreach ($results as $row) {
            $day_name = $day_names[$row->day_num] ?? 'Ukendt';
            $formatted[$day_name] = (int) $row->count;
        }

        return $formatted;
    }

    /**
     * Get posts by month
     */
    public static function get_posts_by_month($months = 12) {
        global $wpdb;

        $results = $wpdb->get_results($wpdb->prepare("
            SELECT DATE_FORMAT(post_date, '%%Y-%%m') as month, COUNT(*) as count
            FROM {$wpdb->posts}
            WHERE post_type = 'product'
            AND post_status = 'publish'
            AND post_date >= DATE_SUB(NOW(), INTERVAL %d MONTH)
            GROUP BY DATE_FORMAT(post_date, '%%Y-%%m')
            ORDER BY month ASC
        ", $months));

        // Fill in missing months
        $formatted = [];
        $month_names = [
            '01' => 'Jan', '02' => 'Feb', '03' => 'Mar', '04' => 'Apr',
            '05' => 'Maj', '06' => 'Jun', '07' => 'Jul', '08' => 'Aug',
            '09' => 'Sep', '10' => 'Okt', '11' => 'Nov', '12' => 'Dec'
        ];

        $current = new DateTime();
        $current->modify("-{$months} months");

        for ($i = 0; $i < $months; $i++) {
            $current->modify('+1 month');
            $key = $current->format('Y-m');
            $label = $month_names[$current->format('m')] . ' ' . $current->format('Y');
            $formatted[$label] = 0;
        }

        foreach ($results as $row) {
            $parts = explode('-', $row->month);
            if (count($parts) === 2) {
                $label = $month_names[$parts[1]] . ' ' . $parts[0];
                if (isset($formatted[$label])) {
                    $formatted[$label] = (int) $row->count;
                }
            }
        }

        return $formatted;
    }

    /**
     * Get posts by hour (busiest times)
     */
    public static function get_posts_by_hour($date_filter = '30days') {
        global $wpdb;

        $range = self::get_date_range($date_filter);

        $results = $wpdb->get_results($wpdb->prepare("
            SELECT HOUR(post_date) as hour, COUNT(*) as count
            FROM {$wpdb->posts}
            WHERE post_type = 'product'
            AND post_status = 'publish'
            AND post_date BETWEEN %s AND %s
            GROUP BY HOUR(post_date)
            ORDER BY hour
        ", $range['start'], $range['end']));

        $formatted = array_fill(0, 24, 0);

        foreach ($results as $row) {
            $formatted[(int) $row->hour] = (int) $row->count;
        }

        return $formatted;
    }

    /**
     * Get trend comparison (current vs previous period)
     */
    public static function get_trends($date_filter = '30days') {
        global $wpdb;

        $range = self::get_date_range($date_filter);
        $current_start = $range['start'];
        $current_end = $range['end'];

        // Calculate previous period
        $diff = strtotime($current_end) - strtotime($current_start);
        $prev_end = date('Y-m-d H:i:s', strtotime($current_start) - 1);
        $prev_start = date('Y-m-d H:i:s', strtotime($prev_end) - $diff);

        // Current period stats
        $current_total = $wpdb->get_var($wpdb->prepare("
            SELECT COUNT(*) FROM {$wpdb->posts}
            WHERE post_type = 'product' AND post_status = 'publish'
            AND post_date BETWEEN %s AND %s
        ", $current_start, $current_end));

        $current_tabt = $wpdb->get_var($wpdb->prepare("
            SELECT COUNT(*) FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'product' AND p.post_status = 'publish'
            AND pm.meta_key IN ('_lost_found_status', '_hittegods_type') AND pm.meta_value IN ('tabt', 'lost')
            AND p.post_date BETWEEN %s AND %s
        ", $current_start, $current_end));

        $current_fundet = $wpdb->get_var($wpdb->prepare("
            SELECT COUNT(*) FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'product' AND p.post_status = 'publish'
            AND pm.meta_key IN ('_lost_found_status', '_hittegods_type') AND pm.meta_value IN ('fundet', 'found')
            AND p.post_date BETWEEN %s AND %s
        ", $current_start, $current_end));

        $current_lukket = $wpdb->get_var($wpdb->prepare("
            SELECT COUNT(*) FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'product' AND p.post_status = 'publish'
            AND pm.meta_key IN ('_lost_found_status', '_hittegods_type') AND pm.meta_value IN ('lukket', 'closed')
            AND p.post_date BETWEEN %s AND %s
        ", $current_start, $current_end));

        // Previous period stats
        $prev_total = $wpdb->get_var($wpdb->prepare("
            SELECT COUNT(*) FROM {$wpdb->posts}
            WHERE post_type = 'product' AND post_status = 'publish'
            AND post_date BETWEEN %s AND %s
        ", $prev_start, $prev_end));

        $prev_tabt = $wpdb->get_var($wpdb->prepare("
            SELECT COUNT(*) FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'product' AND p.post_status = 'publish'
            AND pm.meta_key IN ('_lost_found_status', '_hittegods_type') AND pm.meta_value IN ('tabt', 'lost')
            AND p.post_date BETWEEN %s AND %s
        ", $prev_start, $prev_end));

        $prev_fundet = $wpdb->get_var($wpdb->prepare("
            SELECT COUNT(*) FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'product' AND p.post_status = 'publish'
            AND pm.meta_key IN ('_lost_found_status', '_hittegods_type') AND pm.meta_value IN ('fundet', 'found')
            AND p.post_date BETWEEN %s AND %s
        ", $prev_start, $prev_end));

        // Calculate changes
        $calc_change = function($current, $previous) {
            if ($previous == 0) {
                return $current > 0 ? 100 : 0;
            }
            return round((($current - $previous) / $previous) * 100, 1);
        };

        return [
            'current' => [
                'total' => (int) $current_total,
                'tabt' => (int) $current_tabt,
                'fundet' => (int) $current_fundet,
                'lukket' => (int) $current_lukket,
            ],
            'previous' => [
                'total' => (int) $prev_total,
                'tabt' => (int) $prev_tabt,
                'fundet' => (int) $prev_fundet,
            ],
            'change' => [
                'total' => $calc_change($current_total, $prev_total),
                'tabt' => $calc_change($current_tabt, $prev_tabt),
                'fundet' => $calc_change($current_fundet, $prev_fundet),
            ],
            'period' => [
                'current_start' => $current_start,
                'current_end' => $current_end,
                'prev_start' => $prev_start,
                'prev_end' => $prev_end,
            ],
        ];
    }

    /**
     * Get new users statistics
     */
    public static function get_user_stats($date_filter = '30days') {
        global $wpdb;

        $range = self::get_date_range($date_filter);

        $new_users = $wpdb->get_var($wpdb->prepare("
            SELECT COUNT(*) FROM {$wpdb->users}
            WHERE user_registered BETWEEN %s AND %s
        ", $range['start'], $range['end']));

        $active_users = $wpdb->get_var($wpdb->prepare("
            SELECT COUNT(DISTINCT post_author) FROM {$wpdb->posts}
            WHERE post_type = 'product'
            AND post_status = 'publish'
            AND post_date BETWEEN %s AND %s
        ", $range['start'], $range['end']));

        return [
            'new_registrations' => (int) $new_users,
            'active_posters' => (int) $active_users,
        ];
    }

    /**
     * Get message statistics
     */
    public static function get_message_stats($date_filter = '30days') {
        global $wpdb;

        $range = self::get_date_range($date_filter);
        $msg_table = $wpdb->prefix . 'hg_messages';
        $support_table = $wpdb->prefix . 'hg_support_messages';

        $user_messages = 0;
        $support_messages = 0;

        if ($wpdb->get_var("SHOW TABLES LIKE '$msg_table'") === $msg_table) {
            $user_messages = $wpdb->get_var($wpdb->prepare("
                SELECT COUNT(*) FROM {$msg_table}
                WHERE created_at BETWEEN %s AND %s
            ", $range['start'], $range['end']));
        }

        if ($wpdb->get_var("SHOW TABLES LIKE '$support_table'") === $support_table) {
            $support_messages = $wpdb->get_var($wpdb->prepare("
                SELECT COUNT(*) FROM {$support_table}
                WHERE created_at BETWEEN %s AND %s
            ", $range['start'], $range['end']));
        }

        return [
            'user_messages' => (int) $user_messages,
            'support_messages' => (int) $support_messages,
            'total_messages' => (int) $user_messages + (int) $support_messages,
        ];
    }

    /**
     * Render a simple CSS bar chart
     */
    public static function render_bar_chart($data, $options = []) {
        $defaults = [
            'max_bar_width' => 100,
            'bar_height' => 24,
            'bar_color' => '#1e3a5f',
            'show_values' => true,
            'show_percentages' => false,
        ];
        $opts = array_merge($defaults, $options);

        if (empty($data)) {
            return '<p>Ingen data tilgangelig.</p>';
        }

        $max_value = max(array_values($data));
        if ($max_value === 0) $max_value = 1;

        $total = array_sum($data);

        $html = '<div class="hg-bar-chart">';

        foreach ($data as $label => $value) {
            $width = ($value / $max_value) * $opts['max_bar_width'];
            $percentage = $total > 0 ? round(($value / $total) * 100, 1) : 0;

            $html .= '<div class="hg-bar-row">';
            $html .= '<div class="hg-bar-label">' . esc_html($label) . '</div>';
            $html .= '<div class="hg-bar-container">';
            $html .= '<div class="hg-bar" style="width:' . $width . '%;background:' . $opts['bar_color'] . ';height:' . $opts['bar_height'] . 'px;"></div>';
            if ($opts['show_values']) {
                $display = $opts['show_percentages'] ? $value . ' (' . $percentage . '%)' : $value;
                $html .= '<span class="hg-bar-value">' . $display . '</span>';
            }
            $html .= '</div>';
            $html .= '</div>';
        }

        $html .= '</div>';

        return $html;
    }

    /**
     * Render horizontal bar chart for categories
     */
    public static function render_category_chart($categories) {
        if (empty($categories)) {
            return '<p>Ingen kategorier med opslag.</p>';
        }

        $max_count = $categories[0]->count ?? 1;

        $html = '<div class="hg-category-chart">';

        foreach ($categories as $cat) {
            $width = ($cat->count / $max_count) * 100;

            $html .= '<div class="hg-cat-row">';
            $html .= '<div class="hg-cat-name">' . esc_html($cat->name) . '</div>';
            $html .= '<div class="hg-cat-bar-container">';
            $html .= '<div class="hg-cat-bar" style="width:' . $width . '%;"></div>';
            $html .= '<span class="hg-cat-count">' . (int) $cat->count . '</span>';
            $html .= '</div>';
            $html .= '</div>';
        }

        $html .= '</div>';

        return $html;
    }
}
