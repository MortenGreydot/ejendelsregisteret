<?php
/**
 * Automation Class for Hittegodscentralen Users
 * Handles WP-Cron jobs for auto-close, reminders, and cleanup
 */

if (!defined('ABSPATH')) exit;

class HG_Automation {

    const CRON_AUTO_CLOSE = 'hg_auto_close_posts';
    const CRON_REMINDERS = 'hg_send_reminders';
    const CRON_CLEANUP = 'hg_cleanup_old_posts';
    const CRON_UNREAD_REMINDERS = 'hg_unread_message_reminders';
    const CRON_SHARE_DRIP = 'hg_share_drip_emails';
    const CRON_ANNIVERSARY = 'hg_anniversary_emails';

    /**
     * Initialize automation
     */
    public static function init() {
        // Register cron hooks
        add_action(self::CRON_AUTO_CLOSE, [__CLASS__, 'run_auto_close']);
        add_action(self::CRON_REMINDERS, [__CLASS__, 'run_reminders']);
        add_action(self::CRON_CLEANUP, [__CLASS__, 'run_cleanup']);
        // DEAKTIVERET 2026-06-01: unread-reminder (overflødig ift. besked-notifikation)
        // og share-drip (ingen funktion nu). Ryd evt. allerede planlagte events.
        if (wp_next_scheduled(self::CRON_UNREAD_REMINDERS)) {
            wp_clear_scheduled_hook(self::CRON_UNREAD_REMINDERS);
        }
        if (wp_next_scheduled(self::CRON_SHARE_DRIP)) {
            wp_clear_scheduled_hook(self::CRON_SHARE_DRIP);
        }
        add_action(self::CRON_ANNIVERSARY, [__CLASS__, 'run_anniversary']);

        // Admin AJAX handlers
        add_action('wp_ajax_hg_run_manual_cron', [__CLASS__, 'ajax_run_manual_cron']);
    }

    /**
     * Schedule cron events on plugin activation
     */
    public static function schedule_events() {
        // Auto-close: run daily
        if (!wp_next_scheduled(self::CRON_AUTO_CLOSE)) {
            wp_schedule_event(time(), 'daily', self::CRON_AUTO_CLOSE);
        }

        // Reminders: run daily
        if (!wp_next_scheduled(self::CRON_REMINDERS)) {
            wp_schedule_event(time(), 'daily', self::CRON_REMINDERS);
        }

        // Cleanup: run weekly
        if (!wp_next_scheduled(self::CRON_CLEANUP)) {
            wp_schedule_event(time(), 'weekly', self::CRON_CLEANUP);
        }

        // DEAKTIVERET 2026-06-01: unread-reminder + share-drip planlægges IKKE længere.

        // Anniversary emails: run daily
        if (!wp_next_scheduled(self::CRON_ANNIVERSARY)) {
            wp_schedule_event(time(), 'daily', self::CRON_ANNIVERSARY);
        }
    }

    /**
     * Clear scheduled events on plugin deactivation
     */
    public static function clear_events() {
        wp_clear_scheduled_hook(self::CRON_AUTO_CLOSE);
        wp_clear_scheduled_hook(self::CRON_REMINDERS);
        wp_clear_scheduled_hook(self::CRON_CLEANUP);
        wp_clear_scheduled_hook(self::CRON_UNREAD_REMINDERS);
        wp_clear_scheduled_hook(self::CRON_SHARE_DRIP);
        wp_clear_scheduled_hook(self::CRON_ANNIVERSARY);
    }

    /**
     * Run auto-close for old posts
     */
    public static function run_auto_close() {
        $days = (int) get_option('hg_auto_close_days', 0);

        if ($days <= 0) {
            return; // Disabled
        }

        global $wpdb;

        $cutoff_date = date('Y-m-d H:i:s', strtotime("-{$days} days"));

        // Find posts to close
        $posts = $wpdb->get_results($wpdb->prepare("
            SELECT p.ID, p.post_author, p.post_title
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'product'
            AND p.post_status = 'publish'
            AND pm.meta_key = '_lost_found_status'
            AND pm.meta_value IN ('tabt', 'fundet')
            AND p.post_date < %s
        ", $cutoff_date));

        $count = 0;

        foreach ($posts as $post) {
            // Update status to closed
            update_post_meta($post->ID, '_lost_found_status', 'lukket');
            update_post_meta($post->ID, '_lf_auto_closed', current_time('mysql'));

            // Send notification to user
            $user = get_userdata($post->post_author);
            if ($user) {
                $user_name = get_user_meta($post->post_author, 'first_name', true) ?: $user->display_name;

                if (class_exists('HG_Email_Templates')) {
                    HG_Email_Templates::send('post_expired', $user->user_email, [
                        'user_name' => $user_name,
                        'post_title' => $post->post_title,
                    ]);
                }
            }

            $count++;
        }

        // Log
        if ($count > 0) {
            error_log("HG Automation: Auto-closed {$count} posts older than {$days} days.");
        }

        return $count;
    }

    /**
     * Send reminder emails for expiring posts
     */
    public static function run_reminders() {
        $enabled = (bool) get_option('hg_send_expiry_reminder', 0);
        $days_before = (int) get_option('hg_reminder_days_before', 7);
        $auto_close_days = (int) get_option('hg_auto_close_days', 0);

        if (!$enabled || $auto_close_days <= 0) {
            return;
        }

        global $wpdb;

        // Calculate the date when posts will be auto-closed
        $target_days = $auto_close_days - $days_before;
        if ($target_days <= 0) {
            return;
        }

        $cutoff_start = date('Y-m-d 00:00:00', strtotime("-{$target_days} days"));
        $cutoff_end = date('Y-m-d 23:59:59', strtotime("-{$target_days} days"));

        // Find posts that will expire in X days
        $posts = $wpdb->get_results($wpdb->prepare("
            SELECT p.ID, p.post_author, p.post_title
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
            LEFT JOIN {$wpdb->postmeta} pm2 ON p.ID = pm2.post_id AND pm2.meta_key = '_lf_reminder_sent'
            WHERE p.post_type = 'product'
            AND p.post_status = 'publish'
            AND pm.meta_key = '_lost_found_status'
            AND pm.meta_value IN ('tabt', 'fundet')
            AND p.post_date BETWEEN %s AND %s
            AND pm2.meta_value IS NULL
        ", $cutoff_start, $cutoff_end));

        $count = 0;

        foreach ($posts as $post) {
            $user = get_userdata($post->post_author);
            if (!$user) continue;

            $user_name = get_user_meta($post->post_author, 'first_name', true) ?: $user->display_name;

            if (class_exists('HG_Email_Templates')) {
                HG_Email_Templates::send('post_expiring', $user->user_email, [
                    'user_name' => $user_name,
                    'post_title' => $post->post_title,
                    'post_url' => get_permalink($post->ID),
                    'days_left' => $days_before,
                ]);
            }

            // Mark reminder as sent
            update_post_meta($post->ID, '_lf_reminder_sent', current_time('mysql'));
            $count++;
        }

        if ($count > 0) {
            error_log("HG Automation: Sent {$count} expiry reminder emails.");
        }

        return $count;
    }

    /**
     * Clean up old closed posts
     */
    public static function run_cleanup() {
        $days = (int) get_option('hg_delete_closed_after', 0);

        if ($days <= 0) {
            return; // Disabled
        }

        global $wpdb;

        $cutoff_date = date('Y-m-d H:i:s', strtotime("-{$days} days"));

        // Find closed posts to delete
        $posts = $wpdb->get_results($wpdb->prepare("
            SELECT p.ID
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'product'
            AND p.post_status = 'publish'
            AND pm.meta_key = '_lost_found_status'
            AND pm.meta_value = 'lukket'
            AND p.post_modified < %s
        ", $cutoff_date));

        $count = 0;

        foreach ($posts as $post) {
            wp_delete_post($post->ID, true); // Permanent delete
            $count++;
        }

        // Clean up orphaned metadata
        $wpdb->query("
            DELETE pm FROM {$wpdb->postmeta} pm
            LEFT JOIN {$wpdb->posts} p ON pm.post_id = p.ID
            WHERE p.ID IS NULL
        ");

        if ($count > 0) {
            error_log("HG Automation: Deleted {$count} old closed posts.");
        }

        return $count;
    }

    /**
     * Send reminders for unread messages (24h old)
     */
    public static function run_unread_reminders() {
        global $wpdb;

        $table = $wpdb->prefix . 'hg_messages';

        // Check if messages table exists
        if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") !== $table) {
            return 0;
        }

        // Find messages unread for 24+ hours, where no reminder has been sent
        $messages = $wpdb->get_results($wpdb->prepare("
            SELECT m.id, m.receiver_id, m.sender_id, m.post_id, m.message
            FROM {$table} m
            LEFT JOIN {$wpdb->postmeta} pm ON pm.post_id = m.id AND pm.meta_key = '_hg_unread_reminder_sent'
            WHERE m.is_read = 0
            AND m.created_at < %s
            AND m.created_at > %s
            AND pm.meta_id IS NULL
        ", date('Y-m-d H:i:s', strtotime('-24 hours')), date('Y-m-d H:i:s', strtotime('-7 days'))));

        $count = 0;
        $sent_to = [];

        foreach ($messages as $msg) {
            // Only one reminder per user per run
            if (in_array($msg->receiver_id, $sent_to)) continue;

            $user = get_userdata($msg->receiver_id);
            $sender = get_userdata($msg->sender_id);
            if (!$user || !$sender) continue;

            $user_name = get_user_meta($msg->receiver_id, 'first_name', true) ?: $user->display_name;
            $post_title = get_the_title($msg->post_id) ?: 'din genstand';

            if (class_exists('HG_Email_Templates')) {
                HG_Email_Templates::send('unread_message_reminder', $user->user_email, [
                    'user_name' => $user_name,
                    'sender_name' => $sender->display_name,
                    'post_title' => $post_title,
                ]);
            }

            // Mark reminder sent using options (message IDs aren't post IDs)
            update_option('_hg_unread_reminder_' . $msg->id, current_time('mysql'));
            $sent_to[] = $msg->receiver_id;
            $count++;
        }

        if ($count > 0) {
            error_log("HG Automation: Sent {$count} unread message reminders.");
        }

        return $count;
    }

    /**
     * Send share drip emails (24h after post creation)
     */
    public static function run_share_drip() {
        global $wpdb;

        $cutoff_start = date('Y-m-d H:i:s', strtotime('-25 hours'));
        $cutoff_end = date('Y-m-d H:i:s', strtotime('-23 hours'));

        // Find posts created ~24 hours ago that haven't received the drip
        $posts = $wpdb->get_results($wpdb->prepare("
            SELECT p.ID, p.post_author, p.post_title
            FROM {$wpdb->posts} p
            INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
            LEFT JOIN {$wpdb->postmeta} pm2 ON p.ID = pm2.post_id AND pm2.meta_key = '_hg_share_drip_sent'
            WHERE p.post_type = 'product'
            AND p.post_status = 'publish'
            AND pm.meta_key = '_lost_found_status'
            AND pm.meta_value IN ('tabt', 'fundet')
            AND p.post_date BETWEEN %s AND %s
            AND pm2.meta_value IS NULL
        ", $cutoff_start, $cutoff_end));

        $count = 0;

        foreach ($posts as $post) {
            $user = get_userdata($post->post_author);
            if (!$user) continue;

            $first_name = get_user_meta($post->post_author, 'first_name', true) ?: $user->display_name;
            $status = get_post_meta($post->ID, '_lost_found_status', true);
            $type_label = ($status === 'tabt') ? 'tabt' : 'fundet';

            if (class_exists('HG_Email_Templates')) {
                HG_Email_Templates::send('post_created_share', $user->user_email, [
                    'first_name' => $first_name,
                    'post_title' => $post->post_title,
                    'post_url' => get_permalink($post->ID),
                    'post_type_label' => $type_label,
                ]);
            }

            update_post_meta($post->ID, '_hg_share_drip_sent', current_time('mysql'));
            $count++;
        }

        if ($count > 0) {
            error_log("HG Automation: Sent {$count} share drip emails.");
        }

        return $count;
    }

    /**
     * Send anniversary emails
     */
    public static function run_anniversary() {
        global $wpdb;

        $today_month_day = date('m-d');

        // Find users whose registration date matches today (any year)
        $users = $wpdb->get_results($wpdb->prepare("
            SELECT ID, user_email, display_name, user_registered
            FROM {$wpdb->users}
            WHERE DATE_FORMAT(user_registered, '%%m-%%d') = %s
            AND YEAR(user_registered) < YEAR(NOW())
        ", $today_month_day));

        $count = 0;

        foreach ($users as $user) {
            $years = (int) date('Y') - (int) date('Y', strtotime($user->user_registered));
            if ($years < 1) continue;

            // Check if already sent this year
            $sent_key = '_hg_anniversary_sent_' . date('Y');
            $already_sent = get_user_meta($user->ID, $sent_key, true);
            if ($already_sent) continue;

            $user_name = get_user_meta($user->ID, 'first_name', true) ?: $user->display_name;

            if (class_exists('HG_Email_Templates')) {
                HG_Email_Templates::send('anniversary', $user->user_email, [
                    'user_name' => $user_name,
                    'years' => $years,
                ]);
            }

            update_user_meta($user->ID, $sent_key, current_time('mysql'));
            $count++;
        }

        if ($count > 0) {
            error_log("HG Automation: Sent {$count} anniversary emails.");
        }

        return $count;
    }

    /**
     * Get cron status
     */
    public static function get_cron_status() {
        return [
            'auto_close' => [
                'name' => 'Auto-luk opslag',
                'hook' => self::CRON_AUTO_CLOSE,
                'next_run' => wp_next_scheduled(self::CRON_AUTO_CLOSE),
                'enabled' => (int) get_option('hg_auto_close_days', 0) > 0,
            ],
            'reminders' => [
                'name' => 'Påmindelses-emails',
                'hook' => self::CRON_REMINDERS,
                'next_run' => wp_next_scheduled(self::CRON_REMINDERS),
                'enabled' => (bool) get_option('hg_send_expiry_reminder', 0),
            ],
            'cleanup' => [
                'name' => 'Oprydning',
                'hook' => self::CRON_CLEANUP,
                'next_run' => wp_next_scheduled(self::CRON_CLEANUP),
                'enabled' => (int) get_option('hg_delete_closed_after', 0) > 0,
            ],
            'unread_reminders' => [
                'name' => 'Ulæst besked-påmindelser',
                'hook' => self::CRON_UNREAD_REMINDERS,
                'next_run' => wp_next_scheduled(self::CRON_UNREAD_REMINDERS),
                'enabled' => true,
            ],
            'share_drip' => [
                'name' => 'Del-opslag emails',
                'hook' => self::CRON_SHARE_DRIP,
                'next_run' => wp_next_scheduled(self::CRON_SHARE_DRIP),
                'enabled' => true,
            ],
            'anniversary' => [
                'name' => 'Jubilæums-emails',
                'hook' => self::CRON_ANNIVERSARY,
                'next_run' => wp_next_scheduled(self::CRON_ANNIVERSARY),
                'enabled' => true,
            ],
        ];
    }

    /**
     * AJAX: Run manual cron job
     */
    public static function ajax_run_manual_cron() {
        check_ajax_referer('hg_admin_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Ingen adgang']);
        }

        $job = sanitize_text_field($_POST['job'] ?? '');

        switch ($job) {
            case 'auto_close':
                $count = self::run_auto_close();
                wp_send_json_success(['message' => "Auto-luk gennemført. {$count} opslag lukket."]);
                break;

            case 'reminders':
                $count = self::run_reminders();
                wp_send_json_success(['message' => "Påmindelser sendt. {$count} emails."]);
                break;

            case 'cleanup':
                $count = self::run_cleanup();
                wp_send_json_success(['message' => "Oprydning gennemført. {$count} opslag slettet."]);
                break;

            case 'unread_reminders':
                $count = self::run_unread_reminders();
                wp_send_json_success(['message' => "Ulæst-påmindelser sendt. {$count} emails."]);
                break;

            case 'share_drip':
                $count = self::run_share_drip();
                wp_send_json_success(['message' => "Del-opslag emails sendt. {$count} emails."]);
                break;

            case 'anniversary':
                $count = self::run_anniversary();
                wp_send_json_success(['message' => "Jubilæums-emails sendt. {$count} emails."]);
                break;

            default:
                wp_send_json_error(['message' => 'Ukendt job']);
        }
    }

    /**
     * Get last run time for a cron job
     */
    public static function get_last_run($job) {
        return get_option('hg_cron_last_run_' . $job, null);
    }

    /**
     * Record last run time
     */
    public static function record_last_run($job) {
        update_option('hg_cron_last_run_' . $job, current_time('mysql'));
    }
}

// Initialize
HG_Automation::init();
