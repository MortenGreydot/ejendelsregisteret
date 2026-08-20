<?php
/**
 * Security Class for Hittegodscentralen Users
 * Handles nonces, capability checks, rate limiting
 */

if (!defined('ABSPATH')) exit;

class HG_Security {
    
    /**
     * Verify AJAX nonce
     */
    public static function verify_nonce() {
        $nonce = $_POST['nonce'] ?? $_GET['nonce'] ?? '';
        
        if (!wp_verify_nonce($nonce, 'hg_users_nonce')) {
            wp_send_json_error([
                'message' => 'Sikkerhedsfejl. Prøv at genindlæse siden.'
            ], 403);
        }
    }
    
    /**
     * Require authenticated user for AJAX requests
     */
    public static function require_auth() {
        if (!is_user_logged_in()) {
            wp_send_json_error([
                'message' => 'Du skal være logget ind.'
            ], 401);
        }
    }

    /**
     * Check if current user owns a post
     */
    public static function user_owns_post($post_id) {
        $post = get_post($post_id);
        if (!$post) return false;
        return (int) $post->post_author === get_current_user_id();
    }

    /**
     * Verify post ownership — sends JSON error and exits if not owner
     */
    public static function verify_post_ownership($post_id) {
        if (!self::user_owns_post($post_id)) {
            wp_send_json_error([
                'message' => 'Du har ikke adgang til dette opslag.'
            ], 403);
        }
    }
    
    /**
     * Validate email
     */
    public static function validate_email($email) {
        $email = sanitize_email($email);
        if (!is_email($email)) {
            return false;
        }
        return $email;
    }
    
    /**
     * Validate password strength
     */
    public static function validate_password($password) {
        if (strlen($password) < 8) {
            return [
                'valid' => false,
                'message' => 'Adgangskoden skal være mindst 8 tegn.'
            ];
        }
        return ['valid' => true];
    }
    
    /**
     * Check rate limit for login attempts
     */
    public static function check_rate_limit($identifier, $type = 'login') {
        $transient_key = 'hg_attempts_' . md5($identifier);
        $attempts = get_transient($transient_key) ?: 0;

        // Get configurable limits
        $limits = [
            'login' => (int) get_option('hg_rate_limit_login', 5),
            'msg' => (int) get_option('hg_rate_limit_messages', 10),
            'post' => (int) get_option('hg_rate_limit_posts', 5),
            'support' => 5,
        ];

        // Determine limit based on identifier prefix
        $limit = $limits['login'];
        foreach (['msg', 'support', 'post'] as $prefix) {
            if (strpos($identifier, $prefix . '_') === 0) {
                $limit = $limits[$prefix] ?? 5;
                break;
            }
        }

        $lockout_minutes = (int) get_option('hg_lockout_duration', 15);

        if ($attempts >= $limit) {
            return [
                'allowed' => false,
                'message' => 'For mange forsøg. Prøv igen om ' . $lockout_minutes . ' minutter.',
                'remaining' => 0
            ];
        }

        return [
            'allowed' => true,
            'attempts' => $attempts,
            'remaining' => $limit - $attempts
        ];
    }

    /**
     * Record failed attempt
     */
    public static function record_failed_attempt($identifier) {
        $transient_key = 'hg_attempts_' . md5($identifier);
        $attempts = get_transient($transient_key) ?: 0;
        $lockout_minutes = (int) get_option('hg_lockout_duration', 15);
        set_transient($transient_key, $attempts + 1, $lockout_minutes * MINUTE_IN_SECONDS);
    }
    
    /**
     * Clear login attempts on success
     */
    public static function clear_attempts($identifier) {
        delete_transient('hg_attempts_' . md5($identifier));
    }
    
    /**
     * Generate secure random token
     */
    public static function generate_token($length = 32) {
        return bin2hex(random_bytes($length / 2));
    }
    
    /**
     * Sanitize text input
     */
    public static function sanitize_text($input) {
        return sanitize_text_field(wp_unslash($input));
    }
    
    /**
     * Sanitize textarea input
     */
    public static function sanitize_textarea($input) {
        return sanitize_textarea_field(wp_unslash($input));
    }
}
