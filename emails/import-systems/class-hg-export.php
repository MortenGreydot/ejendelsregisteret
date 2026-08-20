<?php
/**
 * Export Class for Hittegodscentralen Users
 * Handles CSV exports for posts, users, messages, and statistics
 */

if (!defined('ABSPATH')) exit;

class HG_Export {

    /**
     * Initialize export handlers
     */
    public static function init() {
        add_action('wp_ajax_hg_export_posts', [__CLASS__, 'export_posts']);
        add_action('wp_ajax_hg_export_users', [__CLASS__, 'export_users']);
        add_action('wp_ajax_hg_export_messages', [__CLASS__, 'export_messages']);
        add_action('wp_ajax_hg_export_statistics', [__CLASS__, 'export_statistics']);
    }

    /**
     * Generate UTF-8 BOM for Excel compatibility
     */
    private static function get_bom() {
        return "\xEF\xBB\xBF";
    }

    /**
     * Set CSV headers
     */
    private static function set_csv_headers($filename) {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Pragma: no-cache');
        header('Expires: 0');
    }

    /**
     * Convert array to CSV row
     */
    private static function array_to_csv_row($data) {
        $output = fopen('php://temp', 'r+');
        fputcsv($output, $data, ';');
        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);
        return rtrim($csv, "\n");
    }

    /**
     * Export posts to CSV
     */
    public static function export_posts() {
        check_ajax_referer('hg_admin_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_die('Ingen adgang');
        }

        global $wpdb;

        $filename = 'opslag-eksport-' . date('Y-m-d') . '.csv';
        self::set_csv_headers($filename);

        echo self::get_bom();

        // Headers
        $headers = ['ID', 'Titel', 'Status', 'Type', 'Bruger ID', 'Bruger Navn', 'Bruger Email', 'Omrade', 'Dato', 'Kontaktperson', 'Telefon', 'Oprettet', 'Opdateret', 'URL'];
        echo self::array_to_csv_row($headers) . "\n";

        // Get all posts
        $posts = $wpdb->get_results("
            SELECT p.*, u.display_name, u.user_email
            FROM {$wpdb->posts} p
            LEFT JOIN {$wpdb->users} u ON p.post_author = u.ID
            WHERE p.post_type = 'product'
            AND p.post_status IN ('publish', 'draft')
            ORDER BY p.post_date DESC
        ");

        foreach ($posts as $post) {
            $status = get_post_meta($post->ID, '_lost_found_status', true);
            $area = get_post_meta($post->ID, '_lf_by_omraade', true);
            $date = get_post_meta($post->ID, '_lf_date', true);
            $contact_name = get_post_meta($post->ID, '_lf_contact_name', true);
            $contact_phone = get_post_meta($post->ID, '_lf_contact_phone', true);

            $user_name = get_user_meta($post->post_author, 'first_name', true) ?: $post->display_name;

            $row = [
                $post->ID,
                $post->post_title,
                $status,
                $status === 'tabt' ? 'Tabt' : ($status === 'fundet' ? 'Fundet' : 'Lukket'),
                $post->post_author,
                $user_name,
                $post->user_email,
                $area,
                $date,
                $contact_name,
                $contact_phone,
                $post->post_date,
                $post->post_modified,
                get_permalink($post->ID),
            ];

            echo self::array_to_csv_row($row) . "\n";
        }

        exit;
    }

    /**
     * Export users to CSV
     */
    public static function export_users() {
        check_ajax_referer('hg_admin_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_die('Ingen adgang');
        }

        global $wpdb;

        $filename = 'brugere-eksport-' . date('Y-m-d') . '.csv';
        self::set_csv_headers($filename);

        echo self::get_bom();

        // Headers
        $headers = ['ID', 'Brugernavn', 'Email', 'Fornavn', 'Efternavn', 'Telefon', 'Rolle', 'Registreret', 'Seneste Login', 'Antal Opslag'];
        echo self::array_to_csv_row($headers) . "\n";

        // Get users
        $users = get_users([
            'role__in' => ['customer', 'subscriber'],
            'orderby' => 'registered',
            'order' => 'DESC',
        ]);

        foreach ($users as $user) {
            $post_count = $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_author = %d AND post_type = 'product'",
                $user->ID
            ));

            $row = [
                $user->ID,
                $user->user_login,
                $user->user_email,
                get_user_meta($user->ID, 'first_name', true),
                get_user_meta($user->ID, 'last_name', true),
                get_user_meta($user->ID, 'billing_phone', true),
                implode(', ', $user->roles),
                $user->user_registered,
                get_user_meta($user->ID, '_hg_last_login', true) ?: '',
                $post_count,
            ];

            echo self::array_to_csv_row($row) . "\n";
        }

        exit;
    }

    /**
     * Get users CSV data (for bulk export)
     */
    public static function get_users_csv_data($user_ids = []) {
        global $wpdb;

        $csv = self::get_bom();

        // Headers
        $headers = ['ID', 'Brugernavn', 'Email', 'Fornavn', 'Efternavn', 'Telefon', 'Registreret', 'Antal Opslag'];
        $csv .= self::array_to_csv_row($headers) . "\n";

        foreach ($user_ids as $user_id) {
            $user = get_userdata($user_id);
            if (!$user) continue;

            $post_count = $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_author = %d AND post_type = 'product'",
                $user_id
            ));

            $row = [
                $user->ID,
                $user->user_login,
                $user->user_email,
                get_user_meta($user_id, 'first_name', true),
                get_user_meta($user_id, 'last_name', true),
                get_user_meta($user_id, 'billing_phone', true),
                $user->user_registered,
                $post_count,
            ];

            $csv .= self::array_to_csv_row($row) . "\n";
        }

        return $csv;
    }

    /**
     * Export messages to CSV
     */
    public static function export_messages() {
        check_ajax_referer('hg_admin_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_die('Ingen adgang');
        }

        global $wpdb;
        $table = $wpdb->prefix . 'hg_messages';

        $filename = 'beskeder-eksport-' . date('Y-m-d') . '.csv';
        self::set_csv_headers($filename);

        echo self::get_bom();

        // Headers
        $headers = ['ID', 'Fra ID', 'Fra Navn', 'Fra Email', 'Til ID', 'Til Navn', 'Til Email', 'Emne', 'Besked', 'Opslag ID', 'Laest', 'Dato'];
        echo self::array_to_csv_row($headers) . "\n";

        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) {
            exit;
        }

        $messages = $wpdb->get_results("
            SELECT m.*,
                   s.display_name as sender_name, s.user_email as sender_email,
                   r.display_name as receiver_name, r.user_email as receiver_email
            FROM {$table} m
            LEFT JOIN {$wpdb->users} s ON m.sender_id = s.ID
            LEFT JOIN {$wpdb->users} r ON m.receiver_id = r.ID
            ORDER BY m.created_at DESC
        ");

        foreach ($messages as $msg) {
            $row = [
                $msg->id,
                $msg->sender_id,
                $msg->sender_name,
                $msg->sender_email,
                $msg->receiver_id,
                $msg->receiver_name,
                $msg->receiver_email,
                $msg->subject,
                $msg->message,
                $msg->post_id,
                $msg->is_read ? 'Ja' : 'Nej',
                $msg->created_at,
            ];

            echo self::array_to_csv_row($row) . "\n";
        }

        exit;
    }

    /**
     * Export statistics to CSV
     */
    public static function export_statistics() {
        check_ajax_referer('hg_admin_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_die('Ingen adgang');
        }

        $period = isset($_GET['period']) ? sanitize_text_field($_GET['period']) : '30days';

        $filename = 'statistik-eksport-' . date('Y-m-d') . '.csv';
        self::set_csv_headers($filename);

        echo self::get_bom();

        // Get statistics
        $trends = HG_Statistics::get_trends($period);
        $top_categories = HG_Statistics::get_top_categories(20, $period);
        $geo_stats = HG_Statistics::get_geographic_stats(30, $period);
        $weekday_stats = HG_Statistics::get_posts_by_weekday($period);

        // Overview
        echo "OVERSIGT\n";
        echo self::array_to_csv_row(['Metrik', 'Nuvaerende periode', 'Forrige periode', 'aendring (%)']) . "\n";
        echo self::array_to_csv_row(['Opslag i alt', $trends['current']['total'], $trends['previous']['total'], $trends['change']['total'] . '%']) . "\n";
        echo self::array_to_csv_row(['Tabte', $trends['current']['tabt'], $trends['previous']['tabt'], $trends['change']['tabt'] . '%']) . "\n";
        echo self::array_to_csv_row(['Fundne', $trends['current']['fundet'], $trends['previous']['fundet'], $trends['change']['fundet'] . '%']) . "\n";
        echo self::array_to_csv_row(['Lukkede', $trends['current']['lukket'], '', '']) . "\n";
        echo "\n";

        // Top categories
        echo "TOP KATEGORIER\n";
        echo self::array_to_csv_row(['Kategori', 'Antal']) . "\n";
        foreach ($top_categories as $cat) {
            echo self::array_to_csv_row([$cat->name, $cat->count]) . "\n";
        }
        echo "\n";

        // Geographic
        echo "GEOGRAFISK FORDELING\n";
        echo self::array_to_csv_row(['Omrade', 'Antal']) . "\n";
        foreach ($geo_stats as $geo) {
            echo self::array_to_csv_row([$geo->area, $geo->count]) . "\n";
        }
        echo "\n";

        // Weekday
        echo "OPSLAG PER UGEDAG\n";
        echo self::array_to_csv_row(['Dag', 'Antal']) . "\n";
        foreach ($weekday_stats as $day => $count) {
            echo self::array_to_csv_row([$day, $count]) . "\n";
        }

        exit;
    }
}

// Initialize
HG_Export::init();
