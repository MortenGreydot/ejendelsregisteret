<?php
/**
 * Authentication Class for Hittegodscentralen Users
 * Handles login, registration, password reset
 */

if (!defined('ABSPATH')) exit;

class HG_Auth {
    
    /**
     * Check if email exists in system
     */
    public static function check_email() {
        HG_Security::verify_nonce();
        
        $email = HG_Security::validate_email($_POST['email'] ?? '');
        
        if (!$email) {
            wp_send_json_error(['message' => 'Indtast en gyldig email.']);
        }
        
        $user = get_user_by('email', $email);
        
        wp_send_json_success([
            'exists' => (bool) $user,
            'has_password' => $user ? true : false,
        ]);
    }
    
    /**
     * Login user
     */
    public static function login() {
        HG_Security::verify_nonce();
        
        $email = HG_Security::validate_email($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';
        $remember = isset($_POST['remember']) && $_POST['remember'] === 'true';
        
        if (!$email) {
            wp_send_json_error(['message' => 'Indtast en gyldig email.']);
        }
        
        if (empty($password)) {
            wp_send_json_error(['message' => 'Indtast din adgangskode.']);
        }
        
        // Rate limiting
        $rate_check = HG_Security::check_rate_limit($email);
        if (!$rate_check['allowed']) {
            wp_send_json_error(['message' => $rate_check['message']]);
        }
        
        // Get user by email
        $user = get_user_by('email', $email);
        
        if (!$user) {
            HG_Security::record_failed_attempt($email);
            wp_send_json_error(['message' => 'Forkert email eller adgangskode.']);
        }
        
        // Attempt login
        $creds = [
            'user_login' => $user->user_login,
            'user_password' => $password,
            'remember' => $remember,
        ];
        
        $login_result = wp_signon($creds, is_ssl());
        
        if (is_wp_error($login_result)) {
            HG_Security::record_failed_attempt($email);
            wp_send_json_error(['message' => 'Forkert email eller adgangskode.']);
        }
        
        // Success
        HG_Security::clear_attempts($email);
        
        // Update last login
        update_user_meta($login_result->ID, '_hg_last_login', current_time('mysql'));
        
        // Get redirect URL — default to business dashboard if user only has business profile
        $redirect = $_POST['redirect'] ?? '';
        if (!empty($redirect)) {
            $redirect_url = home_url($redirect);
        } else {
            $has_org = get_user_meta($login_result->ID, '_hg_org_id', true);
            $redirect_url = $has_org ? home_url('/hg-admin/') : home_url('/min-side/');
        }
        
        // Fire action for extensibility
        do_action('hg_after_login', $login_result->ID, 'password');
        
        wp_send_json_success([
            'message' => 'Du er nu logget ind!',
            'redirect' => $redirect_url,
        ]);
    }
    
    /**
     * Register new user
     */
    public static function register() {
        HG_Security::verify_nonce();
        
        $email = HG_Security::validate_email($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';
        $password_confirm = $_POST['password_confirm'] ?? '';
        $first_name = HG_Security::sanitize_text($_POST['first_name'] ?? '');
        $phone = HG_Security::sanitize_text($_POST['phone'] ?? '');
        
        // Validations
        if (!$email) {
            wp_send_json_error(['message' => 'Indtast en gyldig email.']);
        }
        
        if (email_exists($email)) {
            wp_send_json_error(['message' => 'Denne email er allerede registreret.']);
        }
        
        $password_check = HG_Security::validate_password($password);
        if (!$password_check['valid']) {
            wp_send_json_error(['message' => $password_check['message']]);
        }
        
        if ($password !== $password_confirm) {
            wp_send_json_error(['message' => 'Adgangskoderne matcher ikke.']);
        }
        
        // Rate limiting
        $rate_check = HG_Security::check_rate_limit($_SERVER['REMOTE_ADDR']);
        if (!$rate_check['allowed']) {
            wp_send_json_error(['message' => $rate_check['message']]);
        }
        
        // Create user
        $username = self::generate_username($email);
        
        $user_id = wp_create_user($username, $password, $email);
        
        if (is_wp_error($user_id)) {
            wp_send_json_error(['message' => 'Kunne ikke oprette konto. Prøv igen.']);
        }
        
        // Set user meta
        if ($first_name) {
            update_user_meta($user_id, 'first_name', $first_name);
        }
        if ($phone) {
            update_user_meta($user_id, 'billing_phone', $phone);
        }
        
        // Set WooCommerce customer role
        $user = new WP_User($user_id);
        $user->set_role('customer');
        
        // Mark registration date
        update_user_meta($user_id, '_hg_registered_at', current_time('mysql'));
        update_user_meta($user_id, '_hg_registration_method', 'email');
        
        // Auto-login
        wp_set_current_user($user_id);
        wp_set_auth_cookie($user_id, true);
        
        // Fire action
        do_action('hg_after_registration', $user_id, 'email');
        
        // Send welcome email
        self::send_welcome_email($user_id);
        
        wp_send_json_success([
            'message' => 'Din konto er oprettet!',
            'redirect' => home_url('/min-side/'),
        ]);
    }
    
    /**
     * Request password reset
     */
    public static function reset_password_request() {
        HG_Security::verify_nonce();
        
        $email = HG_Security::validate_email($_POST['email'] ?? '');
        
        if (!$email) {
            wp_send_json_error(['message' => 'Indtast en gyldig email.']);
        }
        
        // Rate limiting
        $rate_check = HG_Security::check_rate_limit('reset_' . $email);
        if (!$rate_check['allowed']) {
            wp_send_json_error(['message' => $rate_check['message']]);
        }
        
        $user = get_user_by('email', $email);
        
        // Always show success to prevent email enumeration
        if (!$user) {
            wp_send_json_success([
                'message' => 'Hvis emailen findes, har vi sendt et link til at nulstille din kode.'
            ]);
        }
        
        // Generate reset token
        $reset_key = HG_Security::generate_token(32);
        $expiry = time() + (24 * HOUR_IN_SECONDS);
        
        update_user_meta($user->ID, '_hg_reset_key', $reset_key);
        update_user_meta($user->ID, '_hg_reset_expiry', $expiry);
        
        // Send email
        $reset_url = home_url('/nulstil-kode/' . $reset_key);
        $first_name = get_user_meta($user->ID, 'first_name', true) ?: 'Bruger';

        // HG_Email_Templates integration
        if (class_exists('HG_Email_Templates')) {
            HG_Email_Templates::send('password_reset', $email, [
                'user_name' => $first_name,
                'reset_url' => $reset_url,
            ]);
        } else {
            // Fallback
            $subject = 'Nulstil din adgangskode - Hittegodscentralen';
            $message = self::get_email_template('reset-password', [
                'first_name' => $first_name,
                'reset_url' => $reset_url,
            ]);

            $headers = ['Content-Type: text/html; charset=UTF-8'];

            wp_mail($email, $subject, $message, $headers);
        }
        
        HG_Security::record_failed_attempt('reset_' . $email);
        
        wp_send_json_success([
            'message' => 'Vi har sendt et link til at nulstille din kode.'
        ]);
    }
    
    /**
     * Reset password with token
     */
    public static function reset_password() {
        HG_Security::verify_nonce();
        
        $reset_key = HG_Security::sanitize_text($_POST['reset_key'] ?? '');
        $password = $_POST['password'] ?? '';
        $password_confirm = $_POST['password_confirm'] ?? '';
        
        if (empty($reset_key)) {
            wp_send_json_error(['message' => 'Ugyldigt reset-link.']);
        }
        
        // Find user with this reset key
        $users = get_users([
            'meta_key' => '_hg_reset_key',
            'meta_value' => $reset_key,
            'number' => 1,
        ]);
        
        if (empty($users)) {
            wp_send_json_error(['message' => 'Ugyldigt eller udløbet link.']);
        }
        
        $user = $users[0];
        
        // Check expiry
        $expiry = get_user_meta($user->ID, '_hg_reset_expiry', true);
        if (time() > $expiry) {
            delete_user_meta($user->ID, '_hg_reset_key');
            delete_user_meta($user->ID, '_hg_reset_expiry');
            wp_send_json_error(['message' => 'Linket er udløbet. Anmod om et nyt.']);
        }
        
        // Validate password
        $password_check = HG_Security::validate_password($password);
        if (!$password_check['valid']) {
            wp_send_json_error(['message' => $password_check['message']]);
        }
        
        if ($password !== $password_confirm) {
            wp_send_json_error(['message' => 'Adgangskoderne matcher ikke.']);
        }
        
        // Update password
        wp_set_password($password, $user->ID);
        
        // Clear reset tokens
        delete_user_meta($user->ID, '_hg_reset_key');
        delete_user_meta($user->ID, '_hg_reset_expiry');
        
        wp_send_json_success([
            'message' => 'Din adgangskode er ændret! Du kan nu logge ind.',
            'redirect' => home_url('/login?reset=success'),
        ]);
    }
    
    /**
     * Generate unique username from email
     */
    private static function generate_username($email) {
        $base = strstr($email, '@', true);
        $base = sanitize_user($base);
        
        $username = $base;
        $counter = 1;
        
        while (username_exists($username)) {
            $username = $base . $counter;
            $counter++;
        }
        
        return $username;
    }
    
    /**
     * Send welcome email
     */
    public static function send_welcome_email_static($user_id) {
        self::send_welcome_email($user_id);
    }

    private static function send_welcome_email($user_id) {
        $user = get_userdata($user_id);
        $first_name = get_user_meta($user_id, 'first_name', true) ?: 'Bruger';

        // HG_Email_Templates integration
        if (class_exists('HG_Email_Templates')) {
            HG_Email_Templates::send('welcome', $user->user_email, [
                'user_name' => $first_name,
                'login_url' => home_url('/login'),
                'dashboard_url' => home_url('/min-side/'),
            ]);
            return;
        }

        // Fallback
        $subject = 'Velkommen til Hittegodscentralen!';
        $message = self::get_email_template('welcome', [
            'first_name' => $first_name,
            'login_url' => home_url('/login'),
            'dashboard_url' => home_url('/min-side/'),
        ]);

        $headers = ['Content-Type: text/html; charset=UTF-8'];

        wp_mail($user->user_email, $subject, $message, $headers);
    }
    
    /**
     * Get email template
     */
    private static function get_email_template($template, $vars = []) {
        $templates = [
            'welcome' => '
                <!DOCTYPE html>
                <html>
                <head><meta charset="UTF-8"></head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; line-height: 1.6; color: #1e3a5f; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #1e3a5f; margin: 0;">Hittegodscentralen</h1>
                    </div>
                    <h2 style="color: #1e3a5f;">Velkommen, {first_name}!</h2>
                    <p>Tak fordi du oprettede en konto på Hittegodscentralen.</p>
                    <p>Du kan nu:</p>
                    <ul>
                        <li>Oprette opslag for tabte genstande</li>
                        <li>Registrere fundne genstande</li>
                        <li>Få besked når der er et match</li>
                    </ul>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="{dashboard_url}" style="background: #1e3a5f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Gå til dashboard</a>
                    </p>
                    <p style="color: #64748b; font-size: 14px;">Med venlig hilsen,<br>Hittegodscentralen</p>
                </body>
                </html>
            ',
            'reset-password' => '
                <!DOCTYPE html>
                <html>
                <head><meta charset="UTF-8"></head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; line-height: 1.6; color: #1e3a5f; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #1e3a5f; margin: 0;">Hittegodscentralen</h1>
                    </div>
                    <h2 style="color: #1e3a5f;">Nulstil din adgangskode</h2>
                    <p>Hej {first_name},</p>
                    <p>Du har anmodet om at nulstille din adgangskode.</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="{reset_url}" style="background: #1e3a5f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Vælg ny adgangskode</a>
                    </p>
                    <p style="color: #64748b; font-size: 14px;">Linket udløber om 24 timer.</p>
                    <p style="color: #64748b; font-size: 14px;">Hvis du ikke har anmodet om dette, kan du ignorere denne email.</p>
                    <p style="color: #64748b; font-size: 14px;">Med venlig hilsen,<br>Hittegodscentralen</p>
                </body>
                </html>
            ',
        ];
        
        $html = $templates[$template] ?? '';
        
        foreach ($vars as $key => $value) {
            $html = str_replace('{' . $key . '}', esc_html($value), $html);
        }
        
        return $html;
    }
}
