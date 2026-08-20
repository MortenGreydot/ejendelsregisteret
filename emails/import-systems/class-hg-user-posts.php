<?php
/**
 * User Posts Class for Hittegodscentralen Users
 * Handles CRUD operations for user's lost/found posts
 */

if (!defined('ABSPATH')) exit;

class HG_User_Posts {
    
    /**
     * Create a new post (product)
     */
    public static function create_post() {
        HG_Security::verify_nonce();
        HG_Security::require_auth();

        $user_id = get_current_user_id();

        $title = HG_Security::sanitize_text($_POST['title'] ?? '');
        $description = HG_Security::sanitize_textarea($_POST['description'] ?? '');
        $type = in_array($_POST['type'] ?? '', ['tabt', 'fundet']) ? $_POST['type'] : 'tabt';
        $location = HG_Security::sanitize_text($_POST['location'] ?? '');
        $date = HG_Security::sanitize_text($_POST['date'] ?? '');
        $contact_name = HG_Security::sanitize_text($_POST['contact_name'] ?? '');
        $contact_phone = HG_Security::sanitize_text($_POST['contact_phone'] ?? '');
        $contact_email = sanitize_email($_POST['contact_email'] ?? '');

        if (empty($title)) {
            wp_send_json_error(['message' => 'Titel er påkrævet.']);
        }

        $type_en = $type === 'tabt' ? 'lost' : 'found';

        $post_id = wp_insert_post([
            'post_title' => $title,
            'post_content' => $description,
            'post_status' => 'publish',
            'post_type' => 'product',
            'post_author' => $user_id,
        ], true);

        if (is_wp_error($post_id)) {
            wp_send_json_error(['message' => 'Kunne ikke oprette opslaget.']);
        }

        // Set meta fields
        update_post_meta($post_id, '_lost_found_status', $type);
        update_post_meta($post_id, '_hittegods_type', $type_en);
        if (!empty($location)) update_post_meta($post_id, '_lf_by_omraade', $location);
        if (!empty($date)) update_post_meta($post_id, '_lf_date', $date);
        if (!empty($contact_name)) update_post_meta($post_id, '_lf_contact_name', $contact_name);
        if (!empty($contact_phone)) update_post_meta($post_id, '_lf_contact_phone', $contact_phone);
        if (!empty($contact_email)) update_post_meta($post_id, '_lf_contact_email', $contact_email);

        // Also set old meta keys for backwards compatibility
        update_post_meta($post_id, '_hittegods_by', $location);
        update_post_meta($post_id, '_hittegods_date', $date);

        // WooCommerce meta
        update_post_meta($post_id, '_visibility', 'visible');
        update_post_meta($post_id, '_stock_status', 'instock');
        update_post_meta($post_id, '_regular_price', '0');
        update_post_meta($post_id, '_price', '0');
        wp_set_object_terms($post_id, 'simple', 'product_type');

        // Handle image upload
        if (!empty($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            require_once ABSPATH . 'wp-admin/includes/image.php';
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/media.php';

            $attachment_id = media_handle_upload('image', $post_id);

            if (!is_wp_error($attachment_id)) {
                set_post_thumbnail($post_id, $attachment_id);
            }
        }

        do_action('hg_after_post_create', $post_id, $user_id);

        // Send confirmation email if user opted in (checkbox pre-checked)
        $send_confirmation = isset($_POST['send_confirmation']) && $_POST['send_confirmation'] === '1';
        if ($send_confirmation) {
            $recipient = !empty($contact_email) ? $contact_email : wp_get_current_user()->user_email;
            if (!empty($recipient) && is_email($recipient)) {
                $first_name = !empty($contact_name)
                    ? $contact_name
                    : (get_user_meta($user_id, 'first_name', true) ?: '');

                HG_Email_Templates::send('post_created', $recipient, [
                    'first_name'      => $first_name ?: 'der',
                    'post_title'      => $title,
                    'post_type_label' => $type === 'tabt' ? 'tabte' : 'fundne',
                    'post_url'        => get_permalink($post_id),
                    'claim_section'   => '',
                ]);
            }
        }

        wp_send_json_success([
            'message' => 'Opslaget er oprettet!',
            'post_id' => $post_id,
            'redirect' => get_permalink($post_id),
        ]);
    }

    /**
     * Get user's posts
     */
    public static function get_my_posts() {
        HG_Security::verify_nonce();
        HG_Security::require_auth();

        $user_id = get_current_user_id();
        $status = HG_Security::sanitize_text($_GET['status'] ?? '');
        $page = max(1, intval($_GET['page'] ?? 1));
        $per_page = 10;

        $args = [
            'post_type' => 'product',
            'post_status' => ['publish', 'draft'],
            'author' => $user_id,
            'posts_per_page' => $per_page,
            'paged' => $page,
            'orderby' => 'modified',
            'order' => 'DESC',
        ];

        if ($status && in_array($status, ['tabt', 'fundet', 'lukket'])) {
            // Match both Danish and English values to catch all items
            $status_en_map = ['tabt' => 'lost', 'fundet' => 'found', 'lukket' => 'closed'];
            $status_en = $status_en_map[$status] ?? $status;
            $args['meta_query'] = [
                'relation' => 'OR',
                [
                    'key' => '_lost_found_status',
                    'value' => [$status, $status_en],
                    'compare' => 'IN',
                ],
                [
                    'key' => '_hittegods_type',
                    'value' => [$status, $status_en],
                    'compare' => 'IN',
                ],
            ];
        }

        $query = new WP_Query($args);
        $posts = [];

        foreach ($query->posts as $post) {
            $posts[] = self::format_post($post);
        }

        // Also fetch HGB Business items reported by this user's email
        $hgb_items = self::get_hgb_items_for_user($user_id, $status);
        if (!empty($hgb_items)) {
            $posts = array_merge($posts, $hgb_items);
            // Sort all by date descending
            usort($posts, function($a, $b) {
                return strtotime($b['modified'] ?? $b['created']) - strtotime($a['modified'] ?? $a['created']);
            });
        }

        $total = $query->found_posts + count($hgb_items);

        wp_send_json_success([
            'items' => $posts,
            'total' => $total,
            'pages' => $query->max_num_pages,
            'current_page' => $page,
        ]);
    }

    /**
     * Get HGB Business items reported by user's email
     */
    private static function get_hgb_items_for_user($user_id, $status = '') {
        $config = ABSPATH . 'hg-business/config.php';
        $db = ABSPATH . 'hg-business/db.php';
        if (!file_exists($config) || !file_exists($db)) return [];

        require_once $config;
        require_once $db;

        $user_email = wp_get_current_user()->user_email;
        if (!$user_email) return [];

        // Map status filter
        $hgb_status_filter = '';
        if ($status === 'tabt') $hgb_status_filter = 'lost';
        elseif ($status === 'fundet') $hgb_status_filter = 'found';
        elseif ($status === 'lukket') $hgb_status_filter = 'returned';

        $where = ["i.contact_info LIKE ?"];
        $params = ['%' . $user_email . '%'];

        if ($hgb_status_filter) {
            $where[] = "i.status = ?";
            $params[] = $hgb_status_filter;
        }

        $whereStr = implode(' AND ', $where);

        try {
            $items = HGB_DB::fetchAll(
                "SELECT i.*, o.name AS org_name, o.slug AS org_slug
                 FROM hgb_items i
                 JOIN hgb_organizations o ON o.id = i.org_id
                 WHERE {$whereStr}
                 ORDER BY i.created_at DESC
                 LIMIT 50",
                $params
            );
        } catch (Exception $e) {
            return [];
        }

        $result = [];
        $status_map = ['lost' => 'tabt', 'found' => 'fundet', 'returned' => 'lukket'];
        $label_map = ['lost' => 'Tabt', 'found' => 'Fundet', 'returned' => 'Lukket'];

        foreach ($items as $item) {
            // Verify the email is actually in the contact_info JSON (not just a substring match)
            $contactInfo = json_decode($item['contact_info'] ?? '{}', true);
            if (($contactInfo['email'] ?? '') !== $user_email) continue;

            $result[] = [
                'id' => 'hgb_' . $item['id'],
                'title' => $item['title'],
                'status' => $status_map[$item['status']] ?? $item['status'],
                'status_label' => $label_map[$item['status']] ?? ucfirst($item['status']),
                'location' => $item['location'],
                'date' => $item['created_at'],
                'image' => $item['photo_url'] ?: '',
                'url' => home_url('/' . $item['org_slug'] . '/'),
                'created' => $item['created_at'],
                'modified' => $item['created_at'],
                'time_ago' => human_time_diff(strtotime($item['created_at']), current_time('timestamp')) . ' siden',
                'source' => 'business',
                'org_name' => $item['org_name'],
            ];
        }

        return $result;
    }
    
    /**
     * Get single post details
     */
    public static function get_post_details() {
        HG_Security::verify_nonce();
        HG_Security::require_auth();
        
        $post_id = intval($_GET['post_id'] ?? 0);
        
        if (!$post_id) {
            wp_send_json_error(['message' => 'Ugyldigt opslag.']);
        }
        
        HG_Security::verify_post_ownership($post_id);
        
        $post = get_post($post_id);
        
        if (!$post) {
            wp_send_json_error(['message' => 'Opslaget findes ikke.']);
        }
        
        wp_send_json_success([
            'post' => self::format_post($post, true),
        ]);
    }
    
    /**
     * Update a post
     */
    public static function update_post() {
        HG_Security::verify_nonce();
        HG_Security::require_auth();
        
        $post_id = intval($_POST['post_id'] ?? 0);
        
        if (!$post_id) {
            wp_send_json_error(['message' => 'Ugyldigt opslag.']);
        }
        
        HG_Security::verify_post_ownership($post_id);
        
        // Collect data
        $data = [
            'title' => HG_Security::sanitize_text($_POST['title'] ?? ''),
            'description' => HG_Security::sanitize_textarea($_POST['description'] ?? ''),
            'location' => HG_Security::sanitize_text($_POST['location'] ?? ''),
            'date' => HG_Security::sanitize_text($_POST['date'] ?? ''),
            'contact_name' => HG_Security::sanitize_text($_POST['contact_name'] ?? ''),
            'contact_phone' => HG_Security::sanitize_text($_POST['contact_phone'] ?? ''),
            'contact_email' => sanitize_email($_POST['contact_email'] ?? ''),
        ];
        
        // Apply filter for extensibility
        $data = apply_filters('hg_before_post_update', $data, $post_id);
        
        // Validate
        if (empty($data['title'])) {
            wp_send_json_error(['message' => 'Titel er påkrævet.']);
        }
        
        // Update post
        $update_result = wp_update_post([
            'ID' => $post_id,
            'post_title' => $data['title'],
            'post_content' => $data['description'],
        ], true);
        
        if (is_wp_error($update_result)) {
            wp_send_json_error(['message' => 'Kunne ikke opdatere opslaget.']);
        }
        
        // Update meta
        if (!empty($data['location'])) {
            update_post_meta($post_id, '_lf_by_omraade', $data['location']);
        }
        if (!empty($data['date'])) {
            update_post_meta($post_id, '_lf_date', $data['date']);
        }
        if (!empty($data['contact_name'])) {
            update_post_meta($post_id, '_lf_contact_name', $data['contact_name']);
        }
        if (!empty($data['contact_phone'])) {
            update_post_meta($post_id, '_lf_contact_phone', $data['contact_phone']);
        }
        if (!empty($data['contact_email'])) {
            update_post_meta($post_id, '_lf_contact_email', sanitize_email($data['contact_email']));
        }

        // Handle image upload
        if (!empty($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            require_once ABSPATH . 'wp-admin/includes/image.php';
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/media.php';

            $attach_id = media_handle_upload('image', $post_id);
            if (!is_wp_error($attach_id)) {
                set_post_thumbnail($post_id, $attach_id);
            }
        }

        // Fire action
        do_action('hg_after_post_update', $post_id, get_current_user_id());
        
        wp_send_json_success([
            'message' => 'Opslaget er opdateret!',
            'post' => self::format_post(get_post($post_id)),
        ]);
    }
    
    /**
     * Close/mark post as resolved
     */
    public static function close_post() {
        HG_Security::verify_nonce();
        HG_Security::require_auth();
        
        $post_id = intval($_POST['post_id'] ?? 0);
        
        if (!$post_id) {
            wp_send_json_error(['message' => 'Ugyldigt opslag.']);
        }
        
        HG_Security::verify_post_ownership($post_id);
        
        // Update status to closed
        update_post_meta($post_id, '_lost_found_status', 'lukket');
        update_post_meta($post_id, '_lf_closed_at', current_time('mysql'));
        
        // Fire action
        do_action('hg_post_closed', $post_id, get_current_user_id());
        
        wp_send_json_success([
            'message' => 'Opslaget er lukket.',
        ]);
    }
    
    /**
     * Delete post (move to trash)
     */
    public static function delete_post() {
        HG_Security::verify_nonce();
        HG_Security::require_auth();
        
        $post_id = intval($_POST['post_id'] ?? 0);
        
        if (!$post_id) {
            wp_send_json_error(['message' => 'Ugyldigt opslag.']);
        }
        
        HG_Security::verify_post_ownership($post_id);
        
        // Move to trash
        $result = wp_trash_post($post_id);
        
        if (!$result) {
            wp_send_json_error(['message' => 'Kunne ikke slette opslaget.']);
        }
        
        // Fire action
        do_action('hg_post_deleted', $post_id, get_current_user_id());
        
        wp_send_json_success([
            'message' => 'Opslaget er slettet.',
        ]);
    }
    
    /**
     * Format post for JSON response
     */
    private static function format_post($post, $full = false) {
        $post_id = $post->ID;
        
        // Get status and normalize English values to Danish
        $raw_status = get_post_meta($post_id, '_lost_found_status', true);
        if (empty($raw_status)) {
            $raw_status = get_post_meta($post_id, '_hittegods_type', true);
        }
        $status_normalize = ['lost' => 'tabt', 'found' => 'fundet', 'closed' => 'lukket'];
        $status = $status_normalize[$raw_status] ?? $raw_status;

        $data = [
            'id' => $post_id,
            'title' => $post->post_title,
            'status' => $status,
            'location' => get_post_meta($post_id, '_lf_by_omraade', true),
            'date' => get_post_meta($post_id, '_lf_date', true),
            'image' => get_the_post_thumbnail_url($post_id, 'medium') ?: '',
            'url' => get_permalink($post_id),
            'edit_url' => home_url('/rediger-opslag/' . $post_id),
            'created' => $post->post_date,
            'modified' => $post->post_modified,
            'time_ago' => human_time_diff(strtotime($post->post_modified), current_time('timestamp')) . ' siden',
        ];

        // Add status label
        $status_labels = [
            'tabt' => 'Tabt',
            'fundet' => 'Fundet',
            'lukket' => 'Lukket',
        ];
        $data['status_label'] = $status_labels[$data['status']] ?? ucfirst($data['status']);
        
        // Add full details if requested
        if ($full) {
            $data['description'] = $post->post_content;
            $data['contact_name'] = get_post_meta($post_id, '_lf_contact_name', true);
            $data['contact_phone'] = get_post_meta($post_id, '_lf_contact_phone', true);
            
            // Get category
            $terms = get_the_terms($post_id, 'product_cat');
            $data['category'] = !empty($terms) ? $terms[0]->term_id : 0;
            $data['category_name'] = !empty($terms) ? $terms[0]->name : '';
            
            // Get all images
            $gallery_ids = get_post_meta($post_id, '_product_image_gallery', true);
            $images = [];
            
            // Featured image
            $featured = get_post_thumbnail_id($post_id);
            if ($featured) {
                $images[] = [
                    'id' => $featured,
                    'url' => wp_get_attachment_image_url($featured, 'medium'),
                    'full' => wp_get_attachment_image_url($featured, 'full'),
                ];
            }
            
            // Gallery images
            if ($gallery_ids) {
                foreach (explode(',', $gallery_ids) as $img_id) {
                    $images[] = [
                        'id' => $img_id,
                        'url' => wp_get_attachment_image_url($img_id, 'medium'),
                        'full' => wp_get_attachment_image_url($img_id, 'full'),
                    ];
                }
            }
            
            $data['images'] = $images;
        }
        
        return $data;
    }

    /**
     * Handle claim/contact form submission (no login required)
     * Sends post owner an email with the contacter's details
     */
    public static function claim_contact() {
        $post_id = intval($_POST['post_id'] ?? 0);

        if (!$post_id) {
            wp_send_json_error(['message' => 'Ugyldigt opslag.']);
        }

        // Honeypot check
        if (!empty($_POST['website_url'])) {
            wp_send_json_error(['message' => 'Ugyldig forespørgsel.']);
        }

        // Rate limiting by IP: max 5 per hour
        $ip = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
        $transient_key = 'hg_claim_' . md5($ip);
        $count = (int) get_transient($transient_key);
        if ($count >= 5) {
            wp_send_json_error(['message' => 'Du har sendt for mange henvendelser. Prøv igen om lidt.']);
        }

        // Validate inputs
        $contact_name = sanitize_text_field($_POST['contact_name'] ?? '');
        $contact_email = sanitize_email($_POST['contact_email'] ?? '');
        $contact_phone = sanitize_text_field($_POST['contact_phone'] ?? '');
        $contact_message = sanitize_textarea_field($_POST['contact_message'] ?? '');

        if (empty($contact_name)) {
            wp_send_json_error(['message' => 'Indtast dit navn.']);
        }
        if (empty($contact_email) || !is_email($contact_email)) {
            wp_send_json_error(['message' => 'Indtast en gyldig email-adresse.']);
        }
        if (empty($contact_message) || strlen($contact_message) < 10) {
            wp_send_json_error(['message' => 'Skriv en besked (mindst 10 tegn).']);
        }

        // Get the post
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'product' || $post->post_status !== 'publish') {
            wp_send_json_error(['message' => 'Opslaget findes ikke.']);
        }

        // Get post owner email
        $owner = get_userdata($post->post_author);
        if (!$owner) {
            wp_send_json_error(['message' => 'Kunne ikke finde opslagets ejer.']);
        }

        // Also check for contact_email in meta (may differ from WP user email)
        $owner_email = get_post_meta($post_id, '_lf_contact_email', true);
        if (empty($owner_email) || !is_email($owner_email)) {
            $owner_email = $owner->user_email;
        }

        $owner_name = get_user_meta($post->post_author, 'first_name', true);
        if (empty($owner_name)) {
            $owner_name = $owner->display_name ?: explode('@', $owner->user_email)[0];
        }

        $type = get_post_meta($post_id, '_lost_found_status', true);
        $type_label = ($type === 'fundet') ? 'fundne' : 'tabte';

        // Send email via template
        $sent = false;
        if (class_exists('HG_Email_Templates')) {
            $sent = HG_Email_Templates::send('claim_contact', $owner_email, [
                'owner_name'      => $owner_name,
                'post_title'      => $post->post_title,
                'post_type_label' => $type_label,
                'post_url'        => get_permalink($post_id),
                'contact_name'    => esc_html($contact_name),
                'contact_email'   => esc_html($contact_email),
                'contact_phone'   => !empty($contact_phone) ? esc_html($contact_phone) : 'Ikke oplyst',
                'contact_message' => nl2br(esc_html($contact_message)),
            ]);
        }

        if (!$sent) {
            wp_send_json_error(['message' => 'Kunne ikke sende beskeden. Prøv igen.']);
        }

        // Increment rate limit
        set_transient($transient_key, $count + 1, HOUR_IN_SECONDS);

        wp_send_json_success([
            'message' => 'Din henvendelse er sendt! Opslagets ejer modtager dine kontaktoplysninger på email og kan kontakte dig direkte.',
        ]);
    }
}
