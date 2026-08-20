<?php
/**
 * Messaging Class for Hittegodscentralen Users
 * Handles user-to-user messaging system
 */

if (!defined('ABSPATH')) exit;

class HG_Messages {
    
    /**
     * Create messages table on activation
     */
    public static function create_table() {
        global $wpdb;
        $table = $wpdb->prefix . 'hg_messages';
        $charset = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE IF NOT EXISTS $table (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            sender_id BIGINT UNSIGNED NOT NULL,
            receiver_id BIGINT UNSIGNED NOT NULL,
            post_id BIGINT UNSIGNED DEFAULT NULL,
            subject VARCHAR(255),
            message TEXT NOT NULL,
            is_read TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_sender (sender_id),
            INDEX idx_receiver (receiver_id),
            INDEX idx_post (post_id)
        ) $charset;";
        
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);
    }
    
    /**
     * Send message to another user
     */
    public static function send_message() {
        HG_Security::verify_nonce();
        HG_Security::require_auth();
        
        global $wpdb;
        
        $sender_id = get_current_user_id();
        $receiver_id = intval($_POST['receiver_id'] ?? 0);
        $post_id = intval($_POST['post_id'] ?? 0);
        $subject = HG_Security::sanitize_text($_POST['subject'] ?? '');
        $message = HG_Security::sanitize_textarea($_POST['message'] ?? '');
        
        if (!$receiver_id) {
            wp_send_json_error(['message' => 'Ugyldig modtager.']);
        }

        // Check if receiver exists as registered user (blocks messages to guest posts)
        $receiver = get_userdata($receiver_id);
        if (!$receiver) {
            wp_send_json_error(['message' => 'Denne genstand er opslået uden en profil. Du kan ikke sende besked til anonyme opslag.']);
        }

        if ($receiver_id === $sender_id) {
            wp_send_json_error(['message' => 'Du kan ikke sende besked til dig selv.']);
        }
        
        if (empty($message)) {
            wp_send_json_error(['message' => 'Skriv venligst en besked.']);
        }
        
        if (strlen($message) < 5) {
            wp_send_json_error(['message' => 'Beskeden er for kort.']);
        }
        
        // Rate limiting
        $rate_check = HG_Security::check_rate_limit('msg_' . $sender_id);
        if (!$rate_check['allowed']) {
            wp_send_json_error(['message' => 'Du sender for mange beskeder. Vent lidt.']);
        }
        
        // Create table if missing
        self::create_table();
        
        $table = $wpdb->prefix . 'hg_messages';
        
        $result = $wpdb->insert($table, [
            'sender_id' => $sender_id,
            'receiver_id' => $receiver_id,
            'post_id' => $post_id ?: null,
            'subject' => $subject,
            'message' => $message,
            'is_read' => 0,
            'created_at' => current_time('mysql'),
        ], ['%d', '%d', '%d', '%s', '%s', '%d', '%s']);
        
        if ($result === false) {
            error_log('HG Messages insert error: ' . $wpdb->last_error);
            wp_send_json_error(['message' => 'Kunne ikke sende beskeden.']);
        }
        
        HG_Security::record_failed_attempt('msg_' . $sender_id);
        
        // Send email notification
        self::notify_receiver($receiver_id, $sender_id, $message, $subject, $post_id);
        
        wp_send_json_success([
            'message' => 'Beskeden er sendt!',
        ]);
    }
    
    /**
     * Get inbox messages
     */
    public static function get_inbox() {
        HG_Security::verify_nonce();
        HG_Security::require_auth();
        
        global $wpdb;
        
        $user_id = get_current_user_id();
        $page = max(1, intval($_GET['page'] ?? 1));
        $per_page = 20;
        $offset = ($page - 1) * $per_page;
        
        $table = $wpdb->prefix . 'hg_messages';
        
        // Check if table exists
        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) {
            wp_send_json_success(['items' => [], 'total' => 0, 'pages' => 0, 'unread' => 0]);
        }
        
        // Get total
        $total = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$table} WHERE receiver_id = %d",
            $user_id
        ));
        
        // Get unread count
        $unread = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$table} WHERE receiver_id = %d AND is_read = 0",
            $user_id
        ));
        
        // Get messages
        $messages = $wpdb->get_results($wpdb->prepare(
            "SELECT m.*, u.display_name as sender_name, u.user_email as sender_email
             FROM {$table} m
             LEFT JOIN {$wpdb->users} u ON m.sender_id = u.ID
             WHERE m.receiver_id = %d
             ORDER BY m.created_at DESC
             LIMIT %d OFFSET %d",
            $user_id,
            $per_page,
            $offset
        ));
        
        $items = [];
        foreach ($messages as $msg) {
            $sender_name = get_user_meta($msg->sender_id, 'first_name', true);
            if (empty($sender_name)) {
                $sender_name = $msg->sender_name ?: explode('@', $msg->sender_email)[0];
            }
            
            $post_title = '';
            if ($msg->post_id) {
                $post = get_post($msg->post_id);
                $post_title = $post ? $post->post_title : '';
            }
            
            $items[] = [
                'id' => $msg->id,
                'sender_id' => $msg->sender_id,
                'sender_name' => $sender_name,
                'subject' => $msg->subject,
                'message' => $msg->message,
                'post_id' => $msg->post_id,
                'post_title' => $post_title,
                'is_read' => (bool) $msg->is_read,
                'created_at' => $msg->created_at,
                'time_ago' => human_time_diff(strtotime($msg->created_at), current_time('timestamp')) . ' siden',
            ];
        }
        
        wp_send_json_success([
            'items' => $items,
            'total' => (int) $total,
            'pages' => ceil($total / $per_page),
            'unread' => (int) $unread,
        ]);
    }
    
    /**
     * Get sent messages
     */
    public static function get_sent() {
        HG_Security::verify_nonce();
        HG_Security::require_auth();
        
        global $wpdb;
        
        $user_id = get_current_user_id();
        $page = max(1, intval($_GET['page'] ?? 1));
        $per_page = 20;
        $offset = ($page - 1) * $per_page;
        
        $table = $wpdb->prefix . 'hg_messages';
        
        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) {
            wp_send_json_success(['items' => [], 'total' => 0, 'pages' => 0]);
        }
        
        $total = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$table} WHERE sender_id = %d",
            $user_id
        ));
        
        $messages = $wpdb->get_results($wpdb->prepare(
            "SELECT m.*, u.display_name as receiver_name, u.user_email as receiver_email
             FROM {$table} m
             LEFT JOIN {$wpdb->users} u ON m.receiver_id = u.ID
             WHERE m.sender_id = %d
             ORDER BY m.created_at DESC
             LIMIT %d OFFSET %d",
            $user_id,
            $per_page,
            $offset
        ));
        
        $items = [];
        foreach ($messages as $msg) {
            $receiver_name = get_user_meta($msg->receiver_id, 'first_name', true);
            if (empty($receiver_name)) {
                $receiver_name = $msg->receiver_name ?: explode('@', $msg->receiver_email)[0];
            }
            
            $items[] = [
                'id' => $msg->id,
                'receiver_id' => $msg->receiver_id,
                'receiver_name' => $receiver_name,
                'subject' => $msg->subject,
                'message' => $msg->message,
                'is_read' => (bool) $msg->is_read,
                'created_at' => $msg->created_at,
                'time_ago' => human_time_diff(strtotime($msg->created_at), current_time('timestamp')) . ' siden',
            ];
        }
        
        wp_send_json_success([
            'items' => $items,
            'total' => (int) $total,
            'pages' => ceil($total / $per_page),
        ]);
    }
    
    /**
     * Mark message as read
     */
    public static function mark_read() {
        HG_Security::verify_nonce();
        HG_Security::require_auth();
        
        global $wpdb;
        
        $message_id = intval($_POST['message_id'] ?? 0);
        $user_id = get_current_user_id();
        
        $table = $wpdb->prefix . 'hg_messages';
        
        $wpdb->update(
            $table,
            ['is_read' => 1],
            ['id' => $message_id, 'receiver_id' => $user_id],
            ['%d'],
            ['%d', '%d']
        );
        
        wp_send_json_success();
    }
    
    /**
     * Get unread count
     */
    public static function get_unread_count() {
        HG_Security::verify_nonce();
        HG_Security::require_auth();
        
        global $wpdb;
        
        $user_id = get_current_user_id();
        $table = $wpdb->prefix . 'hg_messages';
        
        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) {
            wp_send_json_success(['count' => 0]);
        }
        
        $count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$table} WHERE receiver_id = %d AND is_read = 0",
            $user_id
        ));
        
        wp_send_json_success(['count' => (int) $count]);
    }
    
    /**
     * Delete message
     */
    public static function delete_message() {
        HG_Security::verify_nonce();
        HG_Security::require_auth();
        
        global $wpdb;
        
        $message_id = intval($_POST['message_id'] ?? 0);
        $user_id = get_current_user_id();
        
        $table = $wpdb->prefix . 'hg_messages';
        
        // Only allow deleting own received messages
        $wpdb->delete(
            $table,
            ['id' => $message_id, 'receiver_id' => $user_id],
            ['%d', '%d']
        );
        
        wp_send_json_success();
    }
    
    /**
     * Notify receiver via email
     */
    private static function notify_receiver($receiver_id, $sender_id, $message, $subject, $post_id) {
        $receiver = get_userdata($receiver_id);
        $sender = get_userdata($sender_id);
        
        if (!$receiver || !$sender) return;
        
        $sender_name = get_user_meta($sender_id, 'first_name', true);
        if (empty($sender_name)) {
            $sender_name = $sender->display_name ?: explode('@', $sender->user_email)[0];
        }
        
        $post_info = '';
        if ($post_id) {
            $post = get_post($post_id);
            if ($post) {
                $post_info = '<p><strong>Vedrørende opslag:</strong> ' . esc_html($post->post_title) . '</p>';
            }
        }
        
        $email_subject = 'Ny besked fra ' . $sender_name . ' - Hittegodscentralen';
        
        $body = '
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; line-height: 1.6; color: #1e3a5f; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #e8956c, #d4a574); padding: 20px; border-radius: 12px 12px 0 0;">
                    <h2 style="color: white; margin: 0;">📬 Ny besked</h2>
                </div>
                <div style="background: #ffffff; padding: 25px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                    <p>Hej!</p>
                    <p><strong>' . esc_html($sender_name) . '</strong> har sendt dig en besked på Hittegodscentralen.</p>
                    ' . $post_info . '
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #e8956c;">
                        ' . nl2br(esc_html($message)) . '
                    </div>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                    <p>
                        <a href="' . home_url('/beskeder') . '" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f, #2d5a8a); color: white; padding: 12px 24px; border-radius: 50px; text-decoration: none; font-weight: 600;">Se besked og svar</a>
                    </p>
                </div>
            </body>
            </html>
        ';
        
        // HG_Email_Templates integration
        if (class_exists('HG_Email_Templates')) {
            $receiver_name = get_user_meta($receiver_id, 'first_name', true) ?: 'Bruger';
            $post_title = $post_id && get_post($post_id) ? get_post($post_id)->post_title : '';

            HG_Email_Templates::send('new_message', $receiver->user_email, [
                'user_name'       => $receiver_name,
                'sender_name'     => $sender_name,
                'message_preview' => nl2br(esc_html($message)),
                'post_title'      => $post_title,
                'inbox_url'       => home_url('/beskeder'),
            ]);
            return;
        }

        // Fallback (fix: rettet fra hittegodsportalen.dk til greydot.dk)
        $headers = [
            'Content-Type: text/html; charset=UTF-8',
            'From: Hittegodscentralen <hittegodscentralen@greydot.dk>',
        ];

        wp_mail($receiver->user_email, $email_subject, $body, $headers);
    }
    
    /**
     * Get conversations list (grouped by other user)
     */
    public static function get_conversations() {
        HG_Security::verify_nonce();
        HG_Security::require_auth();
        
        global $wpdb;
        
        $user_id = get_current_user_id();
        $table = $wpdb->prefix . 'hg_messages';
        
        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) {
            wp_send_json_success(['conversations' => []]);
        }
        
        // Find alle unikke samtalepartnere
        $partners = $wpdb->get_results($wpdb->prepare(
            "SELECT DISTINCT 
                CASE WHEN sender_id = %d THEN receiver_id ELSE sender_id END as partner_id,
                MAX(created_at) as last_message
             FROM {$table}
             WHERE sender_id = %d OR receiver_id = %d
             GROUP BY partner_id
             ORDER BY last_message DESC",
            $user_id, $user_id, $user_id
        ));
        
        $conversations = [];
        
        foreach ($partners as $partner) {
            $partner_user = get_userdata($partner->partner_id);
            if (!$partner_user) continue;
            
            $partner_name = get_user_meta($partner->partner_id, 'first_name', true);
            if (empty($partner_name)) {
                $partner_name = $partner_user->display_name ?: explode('@', $partner_user->user_email)[0];
            }
            
            // Tæl ulæste fra denne partner
            $unread = $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$table} 
                 WHERE receiver_id = %d AND sender_id = %d AND is_read = 0",
                $user_id, $partner->partner_id
            ));
            
            // Hent seneste besked
            $last_msg = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM {$table}
                 WHERE (sender_id = %d AND receiver_id = %d) OR (sender_id = %d AND receiver_id = %d)
                 ORDER BY created_at DESC LIMIT 1",
                $user_id, $partner->partner_id, $partner->partner_id, $user_id
            ));
            
            $conversations[] = [
                'partner_id' => $partner->partner_id,
                'partner_name' => $partner_name,
                'unread' => (int) $unread,
                'last_message' => $last_msg ? wp_trim_words($last_msg->message, 10, '...') : '',
                'last_message_time' => $last_msg ? human_time_diff(strtotime($last_msg->created_at), current_time('timestamp')) . ' siden' : '',
                'is_me_last' => $last_msg ? ($last_msg->sender_id == $user_id) : false,
            ];
        }
        
        wp_send_json_success(['conversations' => $conversations]);
    }
    
    /**
     * Get conversation thread with specific user
     */
    public static function get_conversation() {
        HG_Security::verify_nonce();
        HG_Security::require_auth();
        
        global $wpdb;
        
        $user_id = get_current_user_id();
        $partner_id = intval($_GET['partner_id'] ?? 0);
        
        if (!$partner_id) {
            wp_send_json_error(['message' => 'Ugyldig samtale.']);
        }
        
        $table = $wpdb->prefix . 'hg_messages';
        
        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) {
            wp_send_json_success(['messages' => [], 'partner' => null]);
        }
        
        // Hent partner info
        $partner_user = get_userdata($partner_id);
        $partner_name = '';
        if ($partner_user) {
            $partner_name = get_user_meta($partner_id, 'first_name', true);
            if (empty($partner_name)) {
                $partner_name = $partner_user->display_name ?: explode('@', $partner_user->user_email)[0];
            }
        }
        
        // Hent alle beskeder mellem de to brugere
        $messages = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$table}
             WHERE (sender_id = %d AND receiver_id = %d) OR (sender_id = %d AND receiver_id = %d)
             ORDER BY created_at ASC",
            $user_id, $partner_id, $partner_id, $user_id
        ));
        
        // Marker modtagne beskeder som læst
        $wpdb->update(
            $table,
            ['is_read' => 1],
            ['receiver_id' => $user_id, 'sender_id' => $partner_id],
            ['%d'],
            ['%d', '%d']
        );
        
        $items = [];
        foreach ($messages as $msg) {
            $items[] = [
                'id' => $msg->id,
                'message' => $msg->message,
                'is_me' => ($msg->sender_id == $user_id),
                'created_at' => $msg->created_at,
                'time_ago' => human_time_diff(strtotime($msg->created_at), current_time('timestamp')) . ' siden',
            ];
        }
        
        wp_send_json_success([
            'messages' => $items,
            'partner' => [
                'id' => $partner_id,
                'name' => $partner_name,
            ],
        ]);
    }
}
