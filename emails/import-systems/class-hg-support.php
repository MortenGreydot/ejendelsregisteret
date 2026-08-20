<?php
/**
 * Support Class for Hittegodscentralen Users
 * Handles support messaging system
 */

if (!defined('ABSPATH')) exit;

class HG_Support {
    
    /**
     * Send support message
     */
    public static function send_support() {
        HG_Security::verify_nonce();
        HG_Security::require_auth();
        
        global $wpdb;
        
        $user_id = get_current_user_id();
        $message = HG_Security::sanitize_textarea($_POST['message'] ?? '');
        $subject = HG_Security::sanitize_text($_POST['subject'] ?? 'Generel henvendelse');
        
        if (empty($message)) {
            wp_send_json_error(['message' => 'Skriv venligst en besked.']);
        }
        
        if (strlen($message) < 10) {
            wp_send_json_error(['message' => 'Beskeden er for kort.']);
        }
        
        // Rate limiting - max 5 messages per hour
        $rate_check = HG_Security::check_rate_limit('support_' . $user_id);
        if (!$rate_check['allowed']) {
            wp_send_json_error(['message' => 'Du har sendt for mange beskeder. Prøv igen senere.']);
        }
        
        $table = $wpdb->prefix . 'hg_support_messages';
        
        // Create table if it doesn't exist
        self::maybe_create_table();
        
        $result = $wpdb->insert($table, [
            'user_id' => $user_id,
            'subject' => $subject,
            'message' => $message,
            'status' => 'unread',
            'created_at' => current_time('mysql'),
        ], ['%d', '%s', '%s', '%s', '%s']);
        
        if ($result === false) {
            // Log error for debugging
            error_log('HG Support insert error: ' . $wpdb->last_error);
            
            // Try sending email directly without database
            $user = get_userdata($user_id);
            self::send_email_only($user, $message, $subject);
            
            wp_send_json_success([
                'message' => 'Din besked er sendt til support!',
            ]);
            return;
        }
        
        $message_id = $wpdb->insert_id;
        
        // Record attempt for rate limiting
        HG_Security::record_failed_attempt('support_' . $user_id);
        
        // Send notification email to admin
        self::notify_admin($user_id, $message, $subject);

        // Send auto-reply confirmation to user
        self::send_auto_reply($user_id, $message, $subject);

        // Fire action
        do_action('hg_support_message_sent', $message_id, $user_id, $message);
        
        wp_send_json_success([
            'message' => 'Din besked er sendt! Vi vender tilbage hurtigst muligt.',
            'message_id' => $message_id,
        ]);
    }
    
    /**
     * Create support table if missing
     */
    private static function maybe_create_table() {
        global $wpdb;
        $table = $wpdb->prefix . 'hg_support_messages';
        
        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) {
            $charset = $wpdb->get_charset_collate();
            
            $sql = "CREATE TABLE $table (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                subject VARCHAR(255),
                message TEXT NOT NULL,
                status ENUM('unread','read','replied') DEFAULT 'unread',
                admin_reply TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) $charset;";
            
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
            dbDelta($sql);
        }
    }
    
    /**
     * Send email only (fallback if database fails)
     */
    private static function send_email_only($user, $message, $subject) {
        $first_name = get_user_meta($user->ID, 'first_name', true);
        if (empty($first_name)) {
            $first_name = $user->display_name ?: explode('@', $user->user_email)[0];
        }

        $recipients = self::get_support_recipients();
        $email_subject = '[Hittegodscentralen Support] ' . ($subject ?: 'Ny henvendelse');

        $body = "Ny supportbesked\n\n";
        $body .= "Fra: " . $first_name . " (" . $user->user_email . ")\n";
        $body .= "Emne: " . $subject . "\n\n";
        $body .= "Besked:\n" . $message;
        $body .= "\n\nSvar via WordPress admin: " . admin_url('admin.php?page=hg-support');

        $headers = [
            'From: Hittegodscentralen <hittegodscentralen@greydot.dk>',
        ];

        wp_mail($recipients, $email_subject, $body, $headers);
    }
    
    /**
     * Get support message history
     */
    public static function get_support_history() {
        HG_Security::verify_nonce();
        HG_Security::require_auth();
        
        global $wpdb;
        
        $user_id = get_current_user_id();
        $page = max(1, intval($_GET['page'] ?? 1));
        $per_page = 10;
        $offset = ($page - 1) * $per_page;
        
        $table = $wpdb->prefix . 'hg_support_messages';
        
        // Check if table exists
        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) {
            wp_send_json_success([
                'items' => [],
                'total' => 0,
                'pages' => 0,
            ]);
        }
        
        // Get total count
        $total = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$table} WHERE user_id = %d",
            $user_id
        ));
        
        // Get messages
        $messages = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$table} 
             WHERE user_id = %d 
             ORDER BY created_at DESC 
             LIMIT %d OFFSET %d",
            $user_id,
            $per_page,
            $offset
        ));
        
        $items = [];
        foreach ($messages as $msg) {
            $items[] = [
                'id' => $msg->id,
                'subject' => $msg->subject ?: 'Generel henvendelse',
                'message' => $msg->message,
                'status' => $msg->status,
                'status_label' => self::get_status_label($msg->status),
                'admin_reply' => $msg->admin_reply,
                'created_at' => $msg->created_at,
                'time_ago' => human_time_diff(strtotime($msg->created_at), current_time('timestamp')) . ' siden',
                'has_reply' => !empty($msg->admin_reply),
            ];
        }
        
        // Mark replied messages as read
        $wpdb->update(
            $table,
            ['status' => 'read'],
            ['user_id' => $user_id, 'status' => 'replied'],
            ['%s'],
            ['%d', '%s']
        );
        
        wp_send_json_success([
            'items' => $items,
            'total' => (int) $total,
            'pages' => ceil($total / $per_page),
            'current_page' => $page,
        ]);
    }
    
    /**
     * Send auto-reply confirmation to user
     */
    private static function send_auto_reply($user_id, $message, $subject) {
        $user = get_userdata($user_id);
        if (!$user) return;

        $first_name = get_user_meta($user_id, 'first_name', true);
        if (empty($first_name)) {
            $first_name = $user->display_name ?: explode('@', $user->user_email)[0];
        }

        // Try template system first
        if (class_exists('HG_Email_Templates')) {
            $sent = HG_Email_Templates::send('support_received', $user->user_email, [
                'user_name' => $first_name,
                'subject' => $subject ?: 'Generel henvendelse',
                'message_preview' => wp_trim_words($message, 30, '...'),
            ]);
            if ($sent) return;
        }

        // Fallback: direct email
        $from_name = get_option('hg_from_name', 'Hittegodscentralen');
        $from_email = get_option('hg_from_email', 'hittegodscentralen@greydot.dk');

        $email_subject = 'Vi har modtaget din henvendelse - Hittegodscentralen';
        $body = '
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1e3a5f;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #7ecec2, #5cb8aa); padding: 20px; border-radius: 12px 12px 0 0;">
                        <h2 style="color: white; margin: 0;">Tak for din henvendelse!</h2>
                    </div>
                    <div style="background: #fff; padding: 25px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                        <p>Hej ' . esc_html($first_name) . ',</p>
                        <p>Vi har modtaget din supportbesked og vender tilbage hurtigst muligt.</p>
                        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #7ecec2; margin: 20px 0;">
                            <strong>Emne:</strong> ' . esc_html($subject ?: 'Generel henvendelse') . '
                        </div>
                        <p style="color: #64748b; font-size: 14px;">Du kan se status på din henvendelse under din profil på hittegodscentralen.dk.</p>
                        <p>Med venlig hilsen,<br>Hittegodscentralen</p>
                    </div>
                </div>
            </body>
            </html>
        ';

        $headers = [
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . $from_name . ' <' . $from_email . '>',
        ];

        wp_mail($user->user_email, $email_subject, $body, $headers);
    }

    /**
     * Get all support recipient emails
     */
    private static function get_support_recipients() {
        // Primary support email list (comma-separated in WP option)
        $emails_option = get_option('hg_support_emails', '');

        // Fallback to single email option
        if (empty($emails_option)) {
            $emails_option = get_option('hg_support_email', 'support@greydot.dk');
        }

        // All Greydot staff who should receive support messages
        $default_staff = [
            'support@greydot.dk',
            'adm@greydot.dk',
            'ju.rauchfuss@gmail.com',
        ];

        // Parse option (comma or semicolon separated)
        $configured = array_filter(array_map('trim', preg_split('/[,;]+/', $emails_option)));

        // Merge with defaults, remove duplicates
        $all_recipients = array_unique(array_merge($default_staff, $configured));

        // Validate all emails
        $valid = array_filter($all_recipients, 'is_email');

        return !empty($valid) ? $valid : ['support@greydot.dk'];
    }

    /**
     * Notify admin of new support message
     */
    private static function notify_admin($user_id, $message, $subject) {
        $user = get_userdata($user_id);
        $first_name = get_user_meta($user_id, 'first_name', true);
        if (empty($first_name)) {
            $first_name = $user->display_name ?: explode('@', $user->user_email)[0];
        }

        // Send to ALL staff members
        $recipients = self::get_support_recipients();

        // Nyt design via skabelon-systemet (samme layout + reklame som brugermails).
        if (class_exists('HG_Email_Templates')) {
            $sent = HG_Email_Templates::send('support_notify', $recipients, [
                'from_name'  => $first_name,
                'from_email' => $user->user_email,
                'subject'    => $subject ?: 'Ny henvendelse',
                'message'    => nl2br(esc_html($message)),
                'admin_url'  => admin_url('admin.php?page=hg-support'),
            ]);
            if ($sent) return;
        }

        // Fallback: gammelt direkte design (hvis skabelon-systemet ikke er tilgængeligt)
        $from_name = get_option('hg_from_name', 'Hittegodscentralen');
        $from_email = get_option('hg_from_email', 'hittegodscentralen@greydot.dk');

        $admin_url = admin_url('admin.php?page=hg-support');
        $email_subject = '[Hittegodscentralen Support] ' . ($subject ?: 'Ny henvendelse');

        $body = '
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; line-height: 1.6; color: #1e3a5f; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #7ecec2, #5cb8aa); padding: 20px; border-radius: 12px 12px 0 0;">
                    <h2 style="color: white; margin: 0;">Ny supportbesked</h2>
                </div>
                <div style="background: #ffffff; padding: 25px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                    <p><strong>Fra:</strong> ' . esc_html($first_name) . '</p>
                    <p><strong>Email:</strong> ' . esc_html($user->user_email) . '</p>
                    <p><strong>Emne:</strong> ' . esc_html($subject ?: 'Generel henvendelse') . '</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                    <p><strong>Besked:</strong></p>
                    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #7ecec2;">
                        ' . nl2br(esc_html($message)) . '
                    </div>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                    <p style="color: #64748b; font-size: 13px;">
                        Svar brugeren via WordPress admin: <a href="' . esc_url($admin_url) . '">Support panel</a>
                    </p>
                </div>
            </body>
            </html>
        ';

        $headers = [
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . $from_name . ' <' . $from_email . '>',
        ];

        // Send to all recipients
        wp_mail($recipients, $email_subject, $body, $headers);
    }
    
    /**
     * Get status label in Danish
     */
    private static function get_status_label($status) {
        $labels = [
            'unread' => 'Afventer svar',
            'read' => 'Læst',
            'replied' => 'Besvaret',
        ];
        
        return $labels[$status] ?? ucfirst($status);
    }
}
