<?php
/**
 * Dashboard Class for Hittegodscentralen Users
 * Handles dashboard data and statistics
 * FORBEDRET: Kombinerer bruger-beskeder og support-svar
 */

if (!defined('ABSPATH')) exit;

class HG_Dashboard {
    
    /**
     * Get complete dashboard data
     */
    public static function get_dashboard_data() {
        HG_Security::verify_nonce();
        HG_Security::require_auth();
        
        $user_id = get_current_user_id();
        
        $data = [
            'user' => self::get_user_info($user_id),
            'stats' => self::get_stats($user_id),
            'recent_activity' => self::get_recent_activity($user_id, 5),
            'unread_support' => self::get_unread_support_count($user_id),
            'unread_total' => self::get_total_unread($user_id),
            'combined_inbox' => self::get_combined_inbox($user_id, 5),
        ];
        
        wp_send_json_success($data);
    }
    
    /**
     * Get user info
     */
    public static function get_user_info($user_id) {
        $user = get_userdata($user_id);
        
        $first_name = get_user_meta($user_id, 'first_name', true);
        if (empty($first_name)) {
            $first_name = $user->display_name;
        }
        if (empty($first_name) || $first_name === $user->user_email) {
            $first_name = explode('@', $user->user_email)[0];
        }
        
        return [
            'id' => $user_id,
            'first_name' => $first_name,
            'last_name' => get_user_meta($user_id, 'last_name', true),
            'email' => $user->user_email,
            'phone' => get_user_meta($user_id, 'billing_phone', true),
            'registered' => $user->user_registered,
            'last_login' => get_user_meta($user_id, '_hg_last_login', true),
        ];
    }
    
    /**
     * Get total unread count (bruger-beskeder + support-svar)
     */
    public static function get_total_unread($user_id) {
        global $wpdb;
        
        $unread_messages = 0;
        $unread_support = 0;
        
        // Bruger-beskeder
        $msg_table = $wpdb->prefix . 'hg_messages';
        if ($wpdb->get_var("SHOW TABLES LIKE '$msg_table'") === $msg_table) {
            $unread_messages = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$msg_table} WHERE receiver_id = %d AND is_read = 0",
                $user_id
            ));
        }
        
        // Support-svar
        $support_table = $wpdb->prefix . 'hg_support_messages';
        if ($wpdb->get_var("SHOW TABLES LIKE '$support_table'") === $support_table) {
            $unread_support = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$support_table} 
                 WHERE user_id = %d AND status = 'replied'",
                $user_id
            ));
        }
        
        return [
            'messages' => $unread_messages,
            'support' => $unread_support,
            'total' => $unread_messages + $unread_support,
        ];
    }
    
    /**
     * Get combined inbox (bruger-beskeder + support-svar samlet)
     */
    public static function get_combined_inbox($user_id, $limit = 10) {
        global $wpdb;
        
        $items = [];
        
        // Hent bruger-beskeder
        $msg_table = $wpdb->prefix . 'hg_messages';
        if ($wpdb->get_var("SHOW TABLES LIKE '$msg_table'") === $msg_table) {
            $messages = $wpdb->get_results($wpdb->prepare(
                "SELECT m.*, u.display_name as sender_name, u.user_email as sender_email
                 FROM {$msg_table} m
                 LEFT JOIN {$wpdb->users} u ON m.sender_id = u.ID
                 WHERE m.receiver_id = %d
                 ORDER BY m.created_at DESC
                 LIMIT %d",
                $user_id,
                $limit
            ));
            
            foreach ($messages as $msg) {
                $sender_name = get_user_meta($msg->sender_id, 'first_name', true);
                if (empty($sender_name)) {
                    $sender_name = $msg->sender_name ?: explode('@', $msg->sender_email ?? '')[0];
                }
                
                $post_title = '';
                if ($msg->post_id) {
                    $post = get_post($msg->post_id);
                    $post_title = $post ? $post->post_title : '';
                }
                
                $items[] = [
                    'type' => 'message',
                    'type_label' => 'Privat besked',
                    'id' => $msg->id,
                    'from' => $sender_name ?: 'Bruger',
                    'subject' => $msg->subject ?: ($post_title ? 'Vedr: ' . $post_title : 'Besked'),
                    'preview' => wp_trim_words($msg->message, 12, '...'),
                    'message' => $msg->message,
                    'is_read' => (bool) $msg->is_read,
                    'post_id' => $msg->post_id,
                    'post_title' => $post_title,
                    'created_at' => $msg->created_at,
                    'time_ago' => human_time_diff(strtotime($msg->created_at), current_time('timestamp')) . ' siden',
                    'timestamp' => strtotime($msg->created_at),
                ];
            }
        }
        
        // Hent support-svar
        $support_table = $wpdb->prefix . 'hg_support_messages';
        if ($wpdb->get_var("SHOW TABLES LIKE '$support_table'") === $support_table) {
            $support = $wpdb->get_results($wpdb->prepare(
                "SELECT * FROM {$support_table} 
                 WHERE user_id = %d AND admin_reply IS NOT NULL AND admin_reply != ''
                 ORDER BY updated_at DESC
                 LIMIT %d",
                $user_id,
                $limit
            ));
            
            foreach ($support as $msg) {
                $items[] = [
                    'type' => 'support',
                    'type_label' => 'Support',
                    'id' => $msg->id,
                    'from' => 'Support',
                    'subject' => $msg->subject ?: 'Svar fra support',
                    'preview' => wp_trim_words($msg->admin_reply, 12, '...'),
                    'message' => $msg->admin_reply,
                    'original_message' => $msg->message,
                    'is_read' => ($msg->status !== 'replied'),
                    'created_at' => $msg->updated_at,
                    'time_ago' => human_time_diff(strtotime($msg->updated_at), current_time('timestamp')) . ' siden',
                    'timestamp' => strtotime($msg->updated_at),
                ];
            }
        }
        
        // Sorter efter dato (nyeste først)
        usort($items, function($a, $b) {
            return $b['timestamp'] - $a['timestamp'];
        });
        
        // Begræns til limit
        return array_slice($items, 0, $limit);
    }
    
    /**
     * Get user statistics
     */
    public static function get_stats($user_id) {
        global $wpdb;
        
        // Total posts
        $total = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->posts} 
             WHERE post_author = %d 
             AND post_type = 'product' 
             AND post_status = 'publish'",
            $user_id
        ));
        
        // Tabt posts (COUNT DISTINCT to avoid double-counting from multiple meta keys)
        $tabt = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(DISTINCT p.ID) FROM {$wpdb->posts} p
             JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
             WHERE p.post_author = %d
             AND p.post_type = 'product'
             AND p.post_status = 'publish'
             AND pm.meta_key IN ('_lost_found_status', '_hittegods_type')
             AND pm.meta_value IN ('tabt', 'lost')",
            $user_id
        ));

        // Fundet posts (COUNT DISTINCT to avoid double-counting from multiple meta keys)
        $fundet = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(DISTINCT p.ID) FROM {$wpdb->posts} p
             JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
             WHERE p.post_author = %d
             AND p.post_type = 'product'
             AND p.post_status = 'publish'
             AND pm.meta_key IN ('_lost_found_status', '_hittegods_type')
             AND pm.meta_value IN ('fundet', 'found')",
            $user_id
        ));

        // Closed/matched posts (COUNT DISTINCT to avoid double-counting from multiple meta keys)
        $closed = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(DISTINCT p.ID) FROM {$wpdb->posts} p
             JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
             WHERE p.post_author = %d
             AND p.post_type = 'product'
             AND p.post_status = 'publish'
             AND pm.meta_key IN ('_lost_found_status', '_hittegods_type')
             AND pm.meta_value IN ('lukket', 'closed')",
            $user_id
        ));
        
        // Also count HGB Business items reported by this user
        $hgb_counts = self::get_hgb_stats($user_id);

        return [
            'total_posts' => (int) $total + $hgb_counts['total'],
            'active_tabt' => (int) $tabt + $hgb_counts['lost'],
            'active_fundet' => (int) $fundet + $hgb_counts['found'],
            'closed' => (int) $closed + $hgb_counts['returned'],
        ];
    }

    /**
     * Get HGB Business item stats for user
     */
    private static function get_hgb_stats($user_id) {
        $empty = ['total' => 0, 'lost' => 0, 'found' => 0, 'returned' => 0];

        $config = ABSPATH . 'hg-business/config.php';
        $db = ABSPATH . 'hg-business/db.php';
        if (!file_exists($config) || !file_exists($db)) return $empty;

        require_once $config;
        require_once $db;

        $user_email = wp_get_current_user()->user_email;
        if (!$user_email) return $empty;

        try {
            $items = HGB_DB::fetchAll(
                "SELECT status, contact_info FROM hgb_items WHERE contact_info LIKE ?",
                ['%' . $user_email . '%']
            );
        } catch (Exception $e) {
            return $empty;
        }

        $counts = $empty;
        foreach ($items as $item) {
            $ci = json_decode($item['contact_info'] ?? '{}', true);
            if (($ci['email'] ?? '') !== $user_email) continue;
            $counts['total']++;
            if ($item['status'] === 'lost') $counts['lost']++;
            elseif ($item['status'] === 'found') $counts['found']++;
            elseif ($item['status'] === 'returned') $counts['returned']++;
        }

        return $counts;
    }
    
    /**
     * Get recent activity
     */
    public static function get_recent_activity($user_id, $limit = 5) {
        global $wpdb;
        
        $posts = $wpdb->get_results($wpdb->prepare(
            "SELECT ID, post_title, post_date, post_modified 
             FROM {$wpdb->posts} 
             WHERE post_author = %d 
             AND post_type = 'product'
             AND post_status IN ('publish', 'draft')
             ORDER BY post_modified DESC 
             LIMIT %d",
            $user_id,
            $limit
        ));
        
        $activity = [];
        
        foreach ($posts as $post) {
            $status = get_post_meta($post->ID, '_lost_found_status', true);
            if (empty($status)) {
                $status = get_post_meta($post->ID, '_hittegods_type', true);
            }
            // Normalize English values to Danish
            if ($status === 'lost') $status = 'tabt';
            if ($status === 'found') $status = 'fundet';
            if ($status === 'closed') $status = 'lukket';
            $is_new = strtotime($post->post_date) > strtotime('-1 hour');
            $was_modified = $post->post_date !== $post->post_modified;
            
            $activity[] = [
                'id' => $post->ID,
                'title' => $post->post_title,
                'status' => $status,
                'status_label' => self::get_status_label($status),
                'created' => $post->post_date,
                'modified' => $post->post_modified,
                'action' => $was_modified ? 'opdateret' : 'oprettet',
                'time_ago' => human_time_diff(strtotime($post->post_modified), current_time('timestamp')) . ' siden',
                'url' => get_permalink($post->ID),
                'edit_url' => home_url('/rediger-opslag/' . $post->ID),
            ];
        }
        
        return $activity;
    }
    
    /**
     * Get unread support count
     */
    public static function get_unread_support_count($user_id) {
        global $wpdb;
        $table = $wpdb->prefix . 'hg_support_messages';
        
        // Check if table exists
        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) {
            return 0;
        }
        
        return (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$table} 
             WHERE user_id = %d AND status = 'replied'",
            $user_id
        ));
    }
    
    /**
     * Get status label in Danish
     */
    private static function get_status_label($status) {
        $labels = [
            'tabt' => 'Tabt',
            'fundet' => 'Fundet',
            'lukket' => 'Lukket',
            'matched' => 'Matchet',
        ];
        
        return $labels[$status] ?? ucfirst($status);
    }
}
