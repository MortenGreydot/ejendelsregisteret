<?php
/**
 * Admin Class for Hittegodscentralen Users
 * Backend dashboard for managing users, posts, messages and settings
 */

if (!defined('ABSPATH')) exit;

class HG_Admin {
    
    private static $instance = null;
    
    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function __construct() {
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_assets']);
        
        // AJAX handlers for admin
        add_action('wp_ajax_hg_admin_reply_support', [$this, 'ajax_reply_support']);
        add_action('wp_ajax_hg_admin_delete_user', [$this, 'ajax_delete_user']);
        add_action('wp_ajax_hg_admin_get_user_details', [$this, 'ajax_get_user_details']);

        // Bulk action handlers
        add_action('wp_ajax_hg_admin_bulk_posts', [$this, 'ajax_bulk_posts']);
        add_action('wp_ajax_hg_admin_bulk_users', [$this, 'ajax_bulk_users']);

        // HGB item delete from admin
        add_action('wp_ajax_hg_admin_delete_hgb_item', [$this, 'ajax_delete_hgb_item']);
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        // Main menu
        add_menu_page(
            'Hittegodscentralen',
            'Hittegodscentralen',
            'manage_options',
            'hg-dashboard',
            [$this, 'page_dashboard'],
            'dashicons-search',
            30
        );
        
        // Submenu pages
        add_submenu_page(
            'hg-dashboard',
            'Dashboard',
            'Dashboard',
            'manage_options',
            'hg-dashboard',
            [$this, 'page_dashboard']
        );
        
        add_submenu_page(
            'hg-dashboard',
            'Brugere',
            'Brugere',
            'manage_options',
            'hg-users',
            [$this, 'page_users']
        );
        
        add_submenu_page(
            'hg-dashboard',
            'Opslag',
            'Opslag',
            'manage_options',
            'hg-posts',
            [$this, 'page_posts']
        );
        
        add_submenu_page(
            'hg-dashboard',
            'Support',
            'Support',
            'manage_options',
            'hg-support',
            [$this, 'page_support']
        );
        
        add_submenu_page(
            'hg-dashboard',
            'Beskeder',
            'Beskeder',
            'manage_options',
            'hg-messages',
            [$this, 'page_messages']
        );

        add_submenu_page(
            'hg-dashboard',
            'Statistik',
            'Statistik',
            'manage_options',
            'hg-statistics',
            [$this, 'page_statistics']
        );

        add_submenu_page(
            'hg-dashboard',
            'Indstillinger',
            'Indstillinger',
            'manage_options',
            'hg-settings',
            [$this, 'page_settings']
        );
    }
    
    /**
     * Register settings
     */
    public function register_settings() {
        // Page settings
        register_setting('hg_settings', 'hg_page_login');
        register_setting('hg_settings', 'hg_page_dashboard');
        register_setting('hg_settings', 'hg_page_my_posts');
        register_setting('hg_settings', 'hg_page_edit_post');
        register_setting('hg_settings', 'hg_page_support');
        register_setting('hg_settings', 'hg_page_messages');
        register_setting('hg_settings', 'hg_page_reset_password');
        register_setting('hg_settings', 'hg_page_create_lost');
        register_setting('hg_settings', 'hg_page_create_found');

        // Email settings
        register_setting('hg_settings', 'hg_support_email');
        register_setting('hg_settings', 'hg_from_email');
        register_setting('hg_settings', 'hg_from_name');

        // Feature toggles
        register_setting('hg_settings', 'hg_enable_user_messages');
        register_setting('hg_settings', 'hg_enable_social_login');
        register_setting('hg_settings', 'hg_block_wp_admin');

        // Rate limiting
        register_setting('hg_settings', 'hg_rate_limit_messages', ['default' => 10]);
        register_setting('hg_settings', 'hg_rate_limit_posts', ['default' => 5]);
        register_setting('hg_settings', 'hg_rate_limit_login', ['default' => 5]);
        register_setting('hg_settings', 'hg_lockout_duration', ['default' => 15]);

        // Notifications
        register_setting('hg_settings', 'hg_notify_new_user');
        register_setting('hg_settings', 'hg_notify_new_post');
        register_setting('hg_settings', 'hg_notify_post_closed');

        // Automation / Expiry
        register_setting('hg_settings', 'hg_auto_close_days', ['default' => 0]);
        register_setting('hg_settings', 'hg_send_expiry_reminder');
        register_setting('hg_settings', 'hg_reminder_days_before', ['default' => 7]);
        register_setting('hg_settings', 'hg_delete_closed_after', ['default' => 0]);
        register_setting('hg_settings', 'hg_token_expiry_hours', ['default' => 24]);
        register_setting('hg_settings', 'hg_session_expiry_days', ['default' => 14]);

        // Guest posts
        register_setting('hg_settings', 'hg_allow_guest_posts');
        register_setting('hg_settings', 'hg_guest_require_contact');
    }
    
    /**
     * Enqueue admin assets
     */
    public function enqueue_admin_assets($hook) {
        if (strpos($hook, 'hg-') === false) return;
        
        wp_enqueue_style('hg-admin', HG_USERS_URL . 'assets/css/hg-admin.css', [], HG_USERS_VERSION);
        wp_enqueue_script('hg-admin', HG_USERS_URL . 'assets/js/hg-admin.js', ['jquery'], HG_USERS_VERSION, true);
        wp_localize_script('hg-admin', 'hgAdmin', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('hg_admin_nonce'),
        ]);
    }
    
    /**
     * Dashboard page
     */
    public function page_dashboard() {
        global $wpdb;
        
        // Get stats
        $total_users = count_users();
        $customer_count = isset($total_users['avail_roles']['customer']) ? $total_users['avail_roles']['customer'] : 0;
        $subscriber_count = isset($total_users['avail_roles']['subscriber']) ? $total_users['avail_roles']['subscriber'] : 0;
        $user_count = $customer_count + $subscriber_count;
        
        $total_posts = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'product' AND post_status = 'publish'");
        
        $tabt_count = $wpdb->get_var("
            SELECT COUNT(*) FROM {$wpdb->posts} p
            JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'product' AND p.post_status = 'publish'
            AND pm.meta_key IN ('_lost_found_status', '_hittegods_type') AND pm.meta_value IN ('tabt', 'lost')
        ");

        $fundet_count = $wpdb->get_var("
            SELECT COUNT(*) FROM {$wpdb->posts} p
            JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'product' AND p.post_status = 'publish'
            AND pm.meta_key IN ('_lost_found_status', '_hittegods_type') AND pm.meta_value IN ('fundet', 'found')
        ");
        
        $support_table = $wpdb->prefix . 'hg_support_messages';
        $unread_support = 0;
        if ($wpdb->get_var("SHOW TABLES LIKE '$support_table'") === $support_table) {
            $unread_support = $wpdb->get_var("SELECT COUNT(*) FROM {$support_table} WHERE status = 'unread'");
        }
        
        // Recent users
        $recent_users = get_users([
            'role__in' => ['customer', 'subscriber'],
            'number' => 5,
            'orderby' => 'registered',
            'order' => 'DESC',
        ]);
        
        // Recent posts - check both meta keys
        $recent_posts = $wpdb->get_results("
            SELECT p.*, COALESCE(pm1.meta_value, pm2.meta_value) as status
            FROM {$wpdb->posts} p
            LEFT JOIN {$wpdb->postmeta} pm1 ON p.ID = pm1.post_id AND pm1.meta_key = '_lost_found_status'
            LEFT JOIN {$wpdb->postmeta} pm2 ON p.ID = pm2.post_id AND pm2.meta_key = '_hittegods_type'
            WHERE p.post_type = 'product' AND p.post_status = 'publish'
            ORDER BY p.post_date DESC
            LIMIT 5
        ");
        
        ?>
        <div class="wrap hg-admin">
            <h1>Hittegodscentralen Dashboard</h1>
            
            <div class="hg-admin-stats">
                <div class="hg-admin-stat">
                    <span class="hg-admin-stat__number"><?php echo $user_count; ?></span>
                    <span class="hg-admin-stat__label">Brugere</span>
                </div>
                <div class="hg-admin-stat hg-admin-stat--tabt">
                    <span class="hg-admin-stat__number"><?php echo $tabt_count; ?></span>
                    <span class="hg-admin-stat__label">Tabte opslag</span>
                </div>
                <div class="hg-admin-stat hg-admin-stat--fundet">
                    <span class="hg-admin-stat__number"><?php echo $fundet_count; ?></span>
                    <span class="hg-admin-stat__label">Fundne opslag</span>
                </div>
                <div class="hg-admin-stat">
                    <span class="hg-admin-stat__number"><?php echo $total_posts; ?></span>
                    <span class="hg-admin-stat__label">Opslag i alt</span>
                </div>
                <?php if ($unread_support > 0): ?>
                <div class="hg-admin-stat hg-admin-stat--alert">
                    <span class="hg-admin-stat__number"><?php echo $unread_support; ?></span>
                    <span class="hg-admin-stat__label">Ulæste support</span>
                </div>
                <?php endif; ?>
            </div>
            
            <div class="hg-admin-grid">
                <div class="hg-admin-card">
                    <h2>Seneste brugere</h2>
                    <table class="wp-list-table widefat fixed striped">
                        <thead>
                            <tr>
                                <th>Navn</th>
                                <th>Email</th>
                                <th>Registreret</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($recent_users as $user): ?>
                            <tr>
                                <td><?php echo esc_html(get_user_meta($user->ID, 'first_name', true) ?: $user->display_name); ?></td>
                                <td><?php echo esc_html($user->user_email); ?></td>
                                <td><?php echo date('d/m/Y', strtotime($user->user_registered)); ?></td>
                            </tr>
                            <?php endforeach; ?>
                            <?php if (empty($recent_users)): ?>
                            <tr><td colspan="3">Ingen brugere endnu.</td></tr>
                            <?php endif; ?>
                        </tbody>
                    </table>
                    <p><a href="<?php echo admin_url('admin.php?page=hg-users'); ?>">Se alle brugere →</a></p>
                </div>
                
                <div class="hg-admin-card">
                    <h2>Seneste opslag</h2>
                    <table class="wp-list-table widefat fixed striped">
                        <thead>
                            <tr>
                                <th>Titel</th>
                                <th>Status</th>
                                <th>Dato</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($recent_posts as $post): ?>
                            <tr>
                                <td><a href="<?php echo get_edit_post_link($post->ID); ?>"><?php echo esc_html($post->post_title); ?></a></td>
                                <td>
                                    <span class="hg-badge hg-badge--<?php echo esc_attr($post->status); ?>">
                                        <?php echo $post->status === 'tabt' ? 'Tabt' : ($post->status === 'fundet' ? 'Fundet' : 'Lukket'); ?>
                                    </span>
                                </td>
                                <td><?php echo date('d/m/Y', strtotime($post->post_date)); ?></td>
                            </tr>
                            <?php endforeach; ?>
                            <?php if (empty($recent_posts)): ?>
                            <tr><td colspan="3">Ingen opslag endnu.</td></tr>
                            <?php endif; ?>
                        </tbody>
                    </table>
                    <p><a href="<?php echo admin_url('admin.php?page=hg-posts'); ?>">Se alle opslag →</a></p>
                </div>
            </div>
            
            <div class="hg-admin-card">
                <h2>Hurtige links</h2>
                <div class="hg-admin-links">
                    <a href="<?php echo admin_url('admin.php?page=hg-support'); ?>" class="button">📬 Support beskeder</a>
                    <a href="<?php echo admin_url('admin.php?page=hg-settings'); ?>" class="button">⚙️ Indstillinger</a>
                    <a href="<?php echo home_url('/login'); ?>" class="button" target="_blank">🔗 Login side</a>
                    <a href="<?php echo home_url('/min-side/'); ?>" class="button" target="_blank">🔗 Min side (bruger)</a>
                </div>
            </div>
        </div>
        <?php
    }
    
    /**
     * Users page
     */
    public function page_users() {
        global $wpdb;
        
        $search = isset($_GET['s']) ? sanitize_text_field($_GET['s']) : '';
        $paged = isset($_GET['paged']) ? max(1, intval($_GET['paged'])) : 1;
        $per_page = 20;
        
        $args = [
            'role__in' => ['customer', 'subscriber'],
            'number' => $per_page,
            'offset' => ($paged - 1) * $per_page,
            'orderby' => 'registered',
            'order' => 'DESC',
        ];
        
        if ($search) {
            $args['search'] = '*' . $search . '*';
            $args['search_columns'] = ['user_email', 'display_name'];
        }
        
        $user_query = new WP_User_Query($args);
        $users = $user_query->get_results();
        $total = $user_query->get_total();
        $total_pages = ceil($total / $per_page);
        
        ?>
        <div class="wrap hg-admin">
            <h1>Brugere</h1>

            <div class="hg-admin-filters">
                <form method="get" class="hg-admin-search" style="margin-bottom: 0;">
                    <input type="hidden" name="page" value="hg-users">
                    <input type="search" name="s" value="<?php echo esc_attr($search); ?>" placeholder="Sog efter email eller navn...">
                    <button type="submit" class="button">Sog</button>
                </form>

                <button type="button" class="button hg-export-btn" id="hg-export-users">Eksporter CSV</button>
            </div>

            <!-- Bulk Actions -->
            <div class="hg-bulk-actions" id="hg-bulk-users" style="display: none;">
                <select id="hg-bulk-action-users">
                    <option value="">Valg handling...</option>
                    <option value="email">Send email til valgte</option>
                    <option value="export">Eksporter valgte</option>
                </select>
                <button type="button" class="button button-primary" id="hg-apply-bulk-users">Udfør</button>
                <span class="hg-bulk-count"><span id="hg-selected-users-count">0</span> valgt</span>
            </div>

            <table class="wp-list-table widefat fixed striped" id="hg-users-table">
                <thead>
                    <tr>
                        <th class="hg-checkbox-cell"><input type="checkbox" id="hg-select-all-users"></th>
                        <th style="width:50px;">ID</th>
                        <th>Navn</th>
                        <th>Email</th>
                        <th>Opslag</th>
                        <th>Registreret</th>
                        <th>Seneste login</th>
                        <th style="width:150px;">Handlinger</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($users as $user):
                        $post_count = $wpdb->get_var($wpdb->prepare(
                            "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_author = %d AND post_type = 'product'",
                            $user->ID
                        ));
                        $last_login = get_user_meta($user->ID, '_hg_last_login', true);
                        $first_name = get_user_meta($user->ID, 'first_name', true);
                    ?>
                    <tr data-user-id="<?php echo $user->ID; ?>">
                        <td class="hg-checkbox-cell"><input type="checkbox" class="hg-user-checkbox" value="<?php echo $user->ID; ?>"></td>
                        <td><?php echo $user->ID; ?></td>
                        <td>
                            <strong><?php echo esc_html($first_name ?: $user->display_name); ?></strong>
                        </td>
                        <td><?php echo esc_html($user->user_email); ?></td>
                        <td>
                            <?php if ($post_count > 0): ?>
                            <a href="<?php echo admin_url('admin.php?page=hg-posts&author=' . $user->ID); ?>"><?php echo $post_count; ?> opslag</a>
                            <?php else: ?>
                            0
                            <?php endif; ?>
                        </td>
                        <td><?php echo date('d/m/Y H:i', strtotime($user->user_registered)); ?></td>
                        <td><?php echo $last_login ? date('d/m/Y H:i', strtotime($last_login)) : '-'; ?></td>
                        <td>
                            <a href="<?php echo admin_url('user-edit.php?user_id=' . $user->ID); ?>" class="button button-small">Rediger</a>
                            <button class="button button-small hg-view-user" data-id="<?php echo $user->ID; ?>">Detaljer</button>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    <?php if (empty($users)): ?>
                    <tr><td colspan="8">Ingen brugere fundet.</td></tr>
                    <?php endif; ?>
                </tbody>
            </table>
            
            <?php if ($total_pages > 1): ?>
            <div class="tablenav">
                <div class="tablenav-pages">
                    <?php
                    echo paginate_links([
                        'base' => add_query_arg('paged', '%#%'),
                        'format' => '',
                        'current' => $paged,
                        'total' => $total_pages,
                    ]);
                    ?>
                </div>
            </div>
            <?php endif; ?>
        </div>
        
        <!-- User details modal -->
        <div id="hg-user-modal" class="hg-admin-modal" style="display:none;">
            <div class="hg-admin-modal__overlay"></div>
            <div class="hg-admin-modal__content">
                <button class="hg-admin-modal__close">&times;</button>
                <div id="hg-user-modal-content"></div>
            </div>
        </div>
        <?php
    }
    
    /**
     * Posts page
     */
    public function page_posts() {
        global $wpdb;
        
        $search = isset($_GET['s']) ? sanitize_text_field($_GET['s']) : '';
        $status_filter = isset($_GET['status']) ? sanitize_text_field($_GET['status']) : '';
        $author_filter = isset($_GET['author']) ? intval($_GET['author']) : 0;
        $paged = isset($_GET['paged']) ? max(1, intval($_GET['paged'])) : 1;
        $per_page = 20;
        $offset = ($paged - 1) * $per_page;
        
        $where = "WHERE p.post_type = 'product' AND p.post_status = 'publish'";
        $params = [];
        
        if ($status_filter) {
            $where .= " AND pm.meta_value = %s";
            $params[] = $status_filter;
        }
        
        if ($author_filter) {
            $where .= " AND p.post_author = %d";
            $params[] = $author_filter;
        }
        
        if ($search) {
            $where .= " AND p.post_title LIKE %s";
            $params[] = '%' . $wpdb->esc_like($search) . '%';
        }
        
        $total_query = "SELECT COUNT(DISTINCT p.ID) FROM {$wpdb->posts} p 
                        LEFT JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id AND pm.meta_key = '_lost_found_status'
                        $where";
        
        $total = empty($params) ? $wpdb->get_var($total_query) : $wpdb->get_var($wpdb->prepare($total_query, $params));
        $total_pages = ceil($total / $per_page);
        
        $query = "SELECT p.*, pm.meta_value as status, u.display_name as author_name, u.user_email as author_email
                  FROM {$wpdb->posts} p
                  LEFT JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id AND pm.meta_key = '_lost_found_status'
                  LEFT JOIN {$wpdb->users} u ON p.post_author = u.ID
                  $where
                  ORDER BY p.post_date DESC
                  LIMIT $per_page OFFSET $offset";
        
        $posts = empty($params) ? $wpdb->get_results($query) : $wpdb->get_results($wpdb->prepare($query, $params));
        
        ?>
        <div class="wrap hg-admin">
            <h1>Opslag</h1>

            <div class="hg-admin-filters">
                <form method="get">
                    <input type="hidden" name="page" value="hg-posts">

                    <select name="status">
                        <option value="">Alle statusser</option>
                        <option value="tabt" <?php selected($status_filter, 'tabt'); ?>>Tabt</option>
                        <option value="fundet" <?php selected($status_filter, 'fundet'); ?>>Fundet</option>
                        <option value="lukket" <?php selected($status_filter, 'lukket'); ?>>Lukket</option>
                    </select>

                    <input type="search" name="s" value="<?php echo esc_attr($search); ?>" placeholder="Sog i titel...">

                    <button type="submit" class="button">Filtrer</button>

                    <?php if ($status_filter || $search || $author_filter): ?>
                    <a href="<?php echo admin_url('admin.php?page=hg-posts'); ?>" class="button">Nulstil</a>
                    <?php endif; ?>
                </form>

                <button type="button" class="button hg-export-btn" id="hg-export-posts">Eksporter CSV</button>
            </div>

            <!-- Bulk Actions -->
            <div class="hg-bulk-actions" id="hg-bulk-posts" style="display: none;">
                <select id="hg-bulk-action-posts">
                    <option value="">Valg handling...</option>
                    <option value="close">Luk valgte opslag</option>
                    <option value="status_tabt">Skift status til Tabt</option>
                    <option value="status_fundet">Skift status til Fundet</option>
                    <option value="delete">Slet valgte opslag</option>
                </select>
                <button type="button" class="button button-primary" id="hg-apply-bulk-posts">Udfør</button>
                <span class="hg-bulk-count"><span id="hg-selected-posts-count">0</span> valgt</span>
            </div>

            <table class="wp-list-table widefat fixed striped" id="hg-posts-table">
                <thead>
                    <tr>
                        <th class="hg-checkbox-cell"><input type="checkbox" id="hg-select-all-posts"></th>
                        <th style="width:50px;">ID</th>
                        <th>Titel</th>
                        <th>Status</th>
                        <th>Bruger</th>
                        <th>Dato</th>
                        <th style="width:150px;">Handlinger</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($posts as $post):
                        $author_name = get_user_meta($post->post_author, 'first_name', true) ?: $post->author_name;
                    ?>
                    <tr data-post-id="<?php echo $post->ID; ?>">
                        <td class="hg-checkbox-cell"><input type="checkbox" class="hg-post-checkbox" value="<?php echo $post->ID; ?>"></td>
                        <td><?php echo $post->ID; ?></td>
                        <td>
                            <strong><?php echo esc_html($post->post_title); ?></strong>
                        </td>
                        <td>
                            <span class="hg-badge hg-badge--<?php echo esc_attr($post->status); ?>">
                                <?php echo $post->status === 'tabt' ? 'Tabt' : ($post->status === 'fundet' ? 'Fundet' : 'Lukket'); ?>
                            </span>
                        </td>
                        <td>
                            <?php if ($post->post_author > 0): ?>
                            <a href="<?php echo admin_url('admin.php?page=hg-posts&author=' . $post->post_author); ?>">
                                <?php echo esc_html($author_name); ?>
                            </a>
                            <br><small><?php echo esc_html($post->author_email); ?></small>
                            <?php else: ?>
                            <em>Gaest</em>
                            <?php endif; ?>
                        </td>
                        <td><?php echo date('d/m/Y H:i', strtotime($post->post_date)); ?></td>
                        <td>
                            <a href="<?php echo get_edit_post_link($post->ID); ?>" class="button button-small">Rediger</a>
                            <a href="<?php echo get_permalink($post->ID); ?>" class="button button-small" target="_blank">Se</a>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    <?php if (empty($posts)): ?>
                    <tr><td colspan="7">Ingen opslag fundet.</td></tr>
                    <?php endif; ?>
                </tbody>
            </table>

            <?php if ($total_pages > 1): ?>
            <div class="tablenav">
                <div class="tablenav-pages">
                    <?php
                    echo paginate_links([
                        'base' => add_query_arg('paged', '%#%'),
                        'format' => '',
                        'current' => $paged,
                        'total' => $total_pages,
                    ]);
                    ?>
                </div>
            </div>
            <?php endif; ?>

            <?php
            // HGB Business items overview
            $hgb_config = ABSPATH . 'hg-business/config.php';
            $hgb_db = ABSPATH . 'hg-business/db.php';
            if (file_exists($hgb_config) && file_exists($hgb_db)):
                require_once $hgb_config;
                require_once $hgb_db;
                try {
                    $hgb_where = "1=1";
                    $hgb_params = [];
                    if ($search) {
                        $hgb_where .= " AND i.title LIKE ?";
                        $hgb_params[] = '%' . $search . '%';
                    }
                    $hgb_items = HGB_DB::fetchAll(
                        "SELECT i.*, o.name AS org_name FROM hgb_items i
                         JOIN hgb_organizations o ON o.id = i.org_id
                         WHERE {$hgb_where}
                         ORDER BY i.created_at DESC LIMIT 50",
                        $hgb_params
                    );
                } catch (Exception $e) {
                    $hgb_items = [];
                }
            ?>
            <h2 style="margin-top:30px;">Virksomhedsopslag (HG Business)</h2>
            <p class="description">Opslag oprettet via virksomhedssider. Kan slettes manuelt herfra.</p>
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th style="width:50px;">ID</th>
                        <th>Titel</th>
                        <th>Virksomhed</th>
                        <th>Status</th>
                        <th>Dato</th>
                        <th style="width:100px;">Slet</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    $hgb_status_labels = ['found' => 'Fundet', 'lost' => 'Tabt', 'returned' => 'Returneret', 'expired' => 'Udløbet'];
                    foreach ($hgb_items as $hgb_item):
                        $hgb_badge = $hgb_item['status'] === 'lost' ? 'tabt' : ($hgb_item['status'] === 'found' ? 'fundet' : 'lukket');
                    ?>
                    <tr data-hgb-id="<?= $hgb_item['id'] ?>">
                        <td><?= $hgb_item['id'] ?></td>
                        <td><strong><?= esc_html($hgb_item['title']) ?></strong></td>
                        <td><?= esc_html($hgb_item['org_name']) ?></td>
                        <td><span class="hg-badge hg-badge--<?= $hgb_badge ?>"><?= $hgb_status_labels[$hgb_item['status']] ?? $hgb_item['status'] ?></span></td>
                        <td><?= date('d/m/Y H:i', strtotime($hgb_item['created_at'])) ?></td>
                        <td>
                            <button type="button" class="button button-small hg-admin-delete-hgb" data-id="<?= $hgb_item['id'] ?>" data-org="<?= $hgb_item['org_id'] ?>" style="color:#d63638;">Slet</button>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    <?php if (empty($hgb_items)): ?>
                    <tr><td colspan="6">Ingen virksomhedsopslag.</td></tr>
                    <?php endif; ?>
                </tbody>
            </table>
            <?php endif; ?>
        </div>
        <?php
    }

    /**
     * Support page
     */
    public function page_support() {
        global $wpdb;
        
        $table = $wpdb->prefix . 'hg_support_messages';
        
        // Check if table exists
        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) {
            echo '<div class="wrap"><h1>Support</h1><p>Support tabellen er ikke oprettet. Deaktiver og aktiver plugin igen.</p></div>';
            return;
        }
        
        $status_filter = isset($_GET['status']) ? sanitize_text_field($_GET['status']) : '';
        $paged = isset($_GET['paged']) ? max(1, intval($_GET['paged'])) : 1;
        $per_page = 20;
        $offset = ($paged - 1) * $per_page;
        
        $where = "1=1";
        if ($status_filter) {
            $where = $wpdb->prepare("status = %s", $status_filter);
        }
        
        $total = $wpdb->get_var("SELECT COUNT(*) FROM {$table} WHERE $where");
        $total_pages = ceil($total / $per_page);
        
        $messages = $wpdb->get_results("
            SELECT m.*, u.display_name, u.user_email
            FROM {$table} m
            LEFT JOIN {$wpdb->users} u ON m.user_id = u.ID
            WHERE $where
            ORDER BY m.created_at DESC
            LIMIT $per_page OFFSET $offset
        ");
        
        ?>
        <div class="wrap hg-admin">
            <h1>📬 Support beskeder</h1>
            
            <div class="hg-admin-filters">
                <a href="<?php echo admin_url('admin.php?page=hg-support'); ?>" class="button <?php echo !$status_filter ? 'button-primary' : ''; ?>">Alle</a>
                <a href="<?php echo admin_url('admin.php?page=hg-support&status=unread'); ?>" class="button <?php echo $status_filter === 'unread' ? 'button-primary' : ''; ?>">Ulæste</a>
                <a href="<?php echo admin_url('admin.php?page=hg-support&status=replied'); ?>" class="button <?php echo $status_filter === 'replied' ? 'button-primary' : ''; ?>">Besvaret</a>
            </div>
            
            <div class="hg-support-list">
                <?php foreach ($messages as $msg): 
                    $user_name = get_user_meta($msg->user_id, 'first_name', true) ?: $msg->display_name;
                ?>
                <div class="hg-support-item hg-support-item--<?php echo esc_attr($msg->status); ?>">
                    <div class="hg-support-item__header">
                        <div>
                            <strong><?php echo esc_html($user_name); ?></strong>
                            <span class="hg-support-item__email"><?php echo esc_html($msg->user_email); ?></span>
                        </div>
                        <div>
                            <span class="hg-badge hg-badge--<?php echo $msg->status === 'unread' ? 'tabt' : ($msg->status === 'replied' ? 'fundet' : ''); ?>">
                                <?php echo $msg->status === 'unread' ? 'Ulæst' : ($msg->status === 'replied' ? 'Besvaret' : 'Læst'); ?>
                            </span>
                            <time><?php echo date('d/m/Y H:i', strtotime($msg->created_at)); ?></time>
                        </div>
                    </div>
                    
                    <?php if ($msg->subject): ?>
                    <div class="hg-support-item__subject">Emne: <?php echo esc_html($msg->subject); ?></div>
                    <?php endif; ?>
                    
                    <div class="hg-support-item__message"><?php echo nl2br(esc_html($msg->message)); ?></div>
                    
                    <?php if ($msg->admin_reply): ?>
                    <div class="hg-support-item__reply">
                        <strong>Dit svar:</strong>
                        <p><?php echo nl2br(esc_html($msg->admin_reply)); ?></p>
                    </div>
                    <?php endif; ?>
                    
                    <div class="hg-support-item__actions">
                        <?php if ($msg->status !== 'replied'): ?>
                        <button class="button button-primary hg-reply-btn" data-id="<?php echo $msg->id; ?>" data-email="<?php echo esc_attr($msg->user_email); ?>">
                            Svar
                        </button>
                        <?php else: ?>
                        <button class="button hg-reply-btn" data-id="<?php echo $msg->id; ?>" data-email="<?php echo esc_attr($msg->user_email); ?>">
                            Svar igen
                        </button>
                        <?php endif; ?>
                    </div>
                    
                    <div class="hg-support-item__reply-form" id="reply-form-<?php echo $msg->id; ?>" style="display:none;">
                        <textarea placeholder="Skriv dit svar..." rows="3"></textarea>
                        <div>
                            <button class="button button-primary hg-send-reply" data-id="<?php echo $msg->id; ?>">Send svar (via email)</button>
                            <button class="button hg-cancel-reply">Annuller</button>
                        </div>
                    </div>
                </div>
                <?php endforeach; ?>
                
                <?php if (empty($messages)): ?>
                <p>Ingen beskeder.</p>
                <?php endif; ?>
            </div>
            
            <?php if ($total_pages > 1): ?>
            <div class="tablenav">
                <div class="tablenav-pages">
                    <?php
                    echo paginate_links([
                        'base' => add_query_arg('paged', '%#%'),
                        'format' => '',
                        'current' => $paged,
                        'total' => $total_pages,
                    ]);
                    ?>
                </div>
            </div>
            <?php endif; ?>
        </div>
        <?php
    }
    
    /**
     * Messages page (user-to-user)
     */
    public function page_messages() {
        global $wpdb;
        
        $table = $wpdb->prefix . 'hg_messages';
        
        if ($wpdb->get_var("SHOW TABLES LIKE '$table'") !== $table) {
            echo '<div class="wrap"><h1>Beskeder</h1><p>Besked tabellen er ikke oprettet. Deaktiver og aktiver plugin igen.</p></div>';
            return;
        }
        
        $paged = isset($_GET['paged']) ? max(1, intval($_GET['paged'])) : 1;
        $per_page = 30;
        $offset = ($paged - 1) * $per_page;
        
        $total = $wpdb->get_var("SELECT COUNT(*) FROM {$table}");
        $total_pages = ceil($total / $per_page);
        
        $messages = $wpdb->get_results("
            SELECT m.*, 
                   s.display_name as sender_name, s.user_email as sender_email,
                   r.display_name as receiver_name, r.user_email as receiver_email
            FROM {$table} m
            LEFT JOIN {$wpdb->users} s ON m.sender_id = s.ID
            LEFT JOIN {$wpdb->users} r ON m.receiver_id = r.ID
            ORDER BY m.created_at DESC
            LIMIT $per_page OFFSET $offset
        ");
        
        ?>
        <div class="wrap hg-admin">
            <h1>💬 Bruger beskeder</h1>
            <p>Overblik over beskeder sendt mellem brugere.</p>
            
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th>Fra</th>
                        <th>Til</th>
                        <th>Besked</th>
                        <th>Læst</th>
                        <th>Dato</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($messages as $msg): ?>
                    <tr>
                        <td>
                            <?php echo esc_html($msg->sender_name); ?>
                            <br><small><?php echo esc_html($msg->sender_email); ?></small>
                        </td>
                        <td>
                            <?php echo esc_html($msg->receiver_name); ?>
                            <br><small><?php echo esc_html($msg->receiver_email); ?></small>
                        </td>
                        <td><?php echo esc_html(substr($msg->message, 0, 100)) . (strlen($msg->message) > 100 ? '...' : ''); ?></td>
                        <td><?php echo $msg->is_read ? '✓' : '—'; ?></td>
                        <td><?php echo date('d/m/Y H:i', strtotime($msg->created_at)); ?></td>
                    </tr>
                    <?php endforeach; ?>
                    <?php if (empty($messages)): ?>
                    <tr><td colspan="5">Ingen beskeder endnu.</td></tr>
                    <?php endif; ?>
                </tbody>
            </table>
            
            <?php if ($total_pages > 1): ?>
            <div class="tablenav">
                <div class="tablenav-pages">
                    <?php
                    echo paginate_links([
                        'base' => add_query_arg('paged', '%#%'),
                        'format' => '',
                        'current' => $paged,
                        'total' => $total_pages,
                    ]);
                    ?>
                </div>
            </div>
            <?php endif; ?>
        </div>
        <?php
    }

    /**
     * Statistics page
     */
    public function page_statistics() {
        $date_filter = isset($_GET['period']) ? sanitize_text_field($_GET['period']) : '30days';

        // Get all statistics data
        $trends = HG_Statistics::get_trends($date_filter);
        $top_categories = HG_Statistics::get_top_categories(10, $date_filter);
        $geo_stats = HG_Statistics::get_geographic_stats(15, $date_filter);
        $weekday_stats = HG_Statistics::get_posts_by_weekday($date_filter);
        $monthly_stats = HG_Statistics::get_posts_by_month(12);
        $hour_stats = HG_Statistics::get_posts_by_hour($date_filter);
        $user_stats = HG_Statistics::get_user_stats($date_filter);
        $message_stats = HG_Statistics::get_message_stats($date_filter);

        $filter_labels = [
            '7days' => 'Sidste 7 dage',
            '30days' => 'Sidste 30 dage',
            '3months' => 'Sidste 3 maneder',
            '1year' => 'Sidste ar',
            'all' => 'Alt tid',
        ];
        ?>
        <div class="wrap hg-admin hg-statistics">
            <h1>Statistik</h1>

            <div class="hg-admin-filters">
                <?php foreach ($filter_labels as $key => $label): ?>
                    <a href="<?php echo admin_url('admin.php?page=hg-statistics&period=' . $key); ?>"
                       class="button <?php echo $date_filter === $key ? 'button-primary' : ''; ?>">
                        <?php echo esc_html($label); ?>
                    </a>
                <?php endforeach; ?>

                <a href="<?php echo admin_url('admin.php?page=hg-statistics&period=' . $date_filter . '&export=csv'); ?>"
                   class="button" style="margin-left: auto;">
                    Eksporter CSV
                </a>
            </div>

            <!-- Overview Stats -->
            <div class="hg-admin-stats">
                <div class="hg-admin-stat">
                    <span class="hg-admin-stat__number"><?php echo $trends['current']['total']; ?></span>
                    <span class="hg-admin-stat__label">Opslag i alt</span>
                    <?php if ($trends['change']['total'] != 0): ?>
                        <span class="hg-stat-change hg-stat-change--<?php echo $trends['change']['total'] >= 0 ? 'up' : 'down'; ?>">
                            <?php echo $trends['change']['total'] >= 0 ? '+' : ''; ?><?php echo $trends['change']['total']; ?>%
                        </span>
                    <?php endif; ?>
                </div>
                <div class="hg-admin-stat hg-admin-stat--tabt">
                    <span class="hg-admin-stat__number"><?php echo $trends['current']['tabt']; ?></span>
                    <span class="hg-admin-stat__label">Tabte</span>
                    <?php if ($trends['change']['tabt'] != 0): ?>
                        <span class="hg-stat-change hg-stat-change--<?php echo $trends['change']['tabt'] >= 0 ? 'up' : 'down'; ?>">
                            <?php echo $trends['change']['tabt'] >= 0 ? '+' : ''; ?><?php echo $trends['change']['tabt']; ?>%
                        </span>
                    <?php endif; ?>
                </div>
                <div class="hg-admin-stat hg-admin-stat--fundet">
                    <span class="hg-admin-stat__number"><?php echo $trends['current']['fundet']; ?></span>
                    <span class="hg-admin-stat__label">Fundne</span>
                    <?php if ($trends['change']['fundet'] != 0): ?>
                        <span class="hg-stat-change hg-stat-change--<?php echo $trends['change']['fundet'] >= 0 ? 'up' : 'down'; ?>">
                            <?php echo $trends['change']['fundet'] >= 0 ? '+' : ''; ?><?php echo $trends['change']['fundet']; ?>%
                        </span>
                    <?php endif; ?>
                </div>
                <div class="hg-admin-stat">
                    <span class="hg-admin-stat__number"><?php echo $trends['current']['lukket']; ?></span>
                    <span class="hg-admin-stat__label">Lukkede</span>
                </div>
                <div class="hg-admin-stat">
                    <span class="hg-admin-stat__number"><?php echo $user_stats['new_registrations']; ?></span>
                    <span class="hg-admin-stat__label">Nye brugere</span>
                </div>
                <div class="hg-admin-stat">
                    <span class="hg-admin-stat__number"><?php echo $message_stats['total_messages']; ?></span>
                    <span class="hg-admin-stat__label">Beskeder</span>
                </div>
            </div>

            <div class="hg-admin-grid">
                <!-- Top Categories -->
                <div class="hg-admin-card">
                    <h2>Top kategorier</h2>
                    <?php echo HG_Statistics::render_category_chart($top_categories); ?>
                </div>

                <!-- Geographic Stats -->
                <div class="hg-admin-card">
                    <h2>Geografisk fordeling</h2>
                    <?php
                    $geo_data = [];
                    foreach ($geo_stats as $geo) {
                        $geo_data[$geo->area] = (int) $geo->count;
                    }
                    echo HG_Statistics::render_bar_chart($geo_data, ['bar_color' => '#7ecec2']);
                    ?>
                </div>

                <!-- Weekday Stats -->
                <div class="hg-admin-card">
                    <h2>Opslag per ugedag</h2>
                    <?php echo HG_Statistics::render_bar_chart($weekday_stats, ['bar_color' => '#e8956c']); ?>
                </div>

                <!-- Monthly Stats -->
                <div class="hg-admin-card">
                    <h2>Opslag per maned (sidste 12 maneder)</h2>
                    <?php echo HG_Statistics::render_bar_chart($monthly_stats, ['bar_color' => '#1e3a5f']); ?>
                </div>
            </div>

            <!-- Hour Stats -->
            <div class="hg-admin-card">
                <h2>Travleste tidspunkter</h2>
                <div class="hg-hour-chart">
                    <?php
                    $max_hour = max($hour_stats) ?: 1;
                    for ($h = 0; $h < 24; $h++):
                        $count = $hour_stats[$h];
                        $height = ($count / $max_hour) * 100;
                    ?>
                        <div class="hg-hour-bar" title="<?php echo $h; ?>:00 - <?php echo $count; ?> opslag">
                            <div class="hg-hour-bar-fill" style="height: <?php echo $height; ?>%;"></div>
                            <span class="hg-hour-label"><?php echo $h; ?></span>
                        </div>
                    <?php endfor; ?>
                </div>
            </div>

            <!-- Activity Summary -->
            <div class="hg-admin-card">
                <h2>Aktivitetsoversigt</h2>
                <table class="widefat">
                    <tr>
                        <th>Aktive brugere (oprettet opslag)</th>
                        <td><?php echo $user_stats['active_posters']; ?></td>
                    </tr>
                    <tr>
                        <th>Bruger-til-bruger beskeder</th>
                        <td><?php echo $message_stats['user_messages']; ?></td>
                    </tr>
                    <tr>
                        <th>Support beskeder</th>
                        <td><?php echo $message_stats['support_messages']; ?></td>
                    </tr>
                </table>
            </div>
        </div>
        <?php
    }

    /**
     * Settings page
     */
    public function page_settings() {
        $pages = get_pages();
        $current_tab = isset($_GET['tab']) ? sanitize_text_field($_GET['tab']) : 'pages';

        $tabs = [
            'pages' => 'Sider',
            'email' => 'Email',
            'security' => 'Sikkerhed',
            'automation' => 'Automatisering',
            'notifications' => 'Notifikationer',
            'shortcodes' => 'Shortcodes',
        ];

        // Get cron status for automation tab
        $cron_status = class_exists('HG_Automation') ? HG_Automation::get_cron_status() : [];
        ?>
        <div class="wrap hg-admin">
            <h1>Indstillinger</h1>

            <!-- Tabs -->
            <div class="hg-settings-tabs">
                <?php foreach ($tabs as $tab_id => $tab_name): ?>
                    <a href="<?php echo admin_url('admin.php?page=hg-settings&tab=' . $tab_id); ?>"
                       class="hg-settings-tab <?php echo $current_tab === $tab_id ? 'hg-settings-tab--active' : ''; ?>">
                        <?php echo esc_html($tab_name); ?>
                    </a>
                <?php endforeach; ?>
            </div>

            <form method="post" action="options.php">
                <?php settings_fields('hg_settings'); ?>

                <!-- Pages Tab -->
                <div class="hg-settings-section <?php echo $current_tab === 'pages' ? 'hg-settings-section--active' : ''; ?>">
                    <div class="hg-admin-card">
                        <h2>Side URLs</h2>
                        <p>Valg hvilke sider der bruges til de forskellige funktioner.</p>

                        <table class="form-table">
                            <tr>
                                <th>Login side</th>
                                <td>
                                    <select name="hg_page_login">
                                        <option value="">-- Valg side --</option>
                                        <?php foreach ($pages as $page): ?>
                                        <option value="<?php echo $page->ID; ?>" <?php selected(get_option('hg_page_login'), $page->ID); ?>>
                                            <?php echo esc_html($page->post_title); ?>
                                        </option>
                                        <?php endforeach; ?>
                                    </select>
                                    <code>[hg_login_form]</code>
                                </td>
                            </tr>
                            <tr>
                                <th>Dashboard side</th>
                                <td>
                                    <select name="hg_page_dashboard">
                                        <option value="">-- Valg side --</option>
                                        <?php foreach ($pages as $page): ?>
                                        <option value="<?php echo $page->ID; ?>" <?php selected(get_option('hg_page_dashboard'), $page->ID); ?>>
                                            <?php echo esc_html($page->post_title); ?>
                                        </option>
                                        <?php endforeach; ?>
                                    </select>
                                    <code>[hg_dashboard]</code>
                                </td>
                            </tr>
                            <tr>
                                <th>Mine opslag side</th>
                                <td>
                                    <select name="hg_page_my_posts">
                                        <option value="">-- Valg side --</option>
                                        <?php foreach ($pages as $page): ?>
                                        <option value="<?php echo $page->ID; ?>" <?php selected(get_option('hg_page_my_posts'), $page->ID); ?>>
                                            <?php echo esc_html($page->post_title); ?>
                                        </option>
                                        <?php endforeach; ?>
                                    </select>
                                    <code>[hg_mine_opslag]</code>
                                </td>
                            </tr>
                            <tr>
                                <th>Rediger opslag side</th>
                                <td>
                                    <select name="hg_page_edit_post">
                                        <option value="">-- Valg side --</option>
                                        <?php foreach ($pages as $page): ?>
                                        <option value="<?php echo $page->ID; ?>" <?php selected(get_option('hg_page_edit_post'), $page->ID); ?>>
                                            <?php echo esc_html($page->post_title); ?>
                                        </option>
                                        <?php endforeach; ?>
                                    </select>
                                    <code>[hg_rediger_opslag]</code>
                                </td>
                            </tr>
                            <tr>
                                <th>Support side</th>
                                <td>
                                    <select name="hg_page_support">
                                        <option value="">-- Valg side --</option>
                                        <?php foreach ($pages as $page): ?>
                                        <option value="<?php echo $page->ID; ?>" <?php selected(get_option('hg_page_support'), $page->ID); ?>>
                                            <?php echo esc_html($page->post_title); ?>
                                        </option>
                                        <?php endforeach; ?>
                                    </select>
                                    <code>[hg_support]</code>
                                </td>
                            </tr>
                            <tr>
                                <th>Beskeder side</th>
                                <td>
                                    <select name="hg_page_messages">
                                        <option value="">-- Valg side --</option>
                                        <?php foreach ($pages as $page): ?>
                                        <option value="<?php echo $page->ID; ?>" <?php selected(get_option('hg_page_messages'), $page->ID); ?>>
                                            <?php echo esc_html($page->post_title); ?>
                                        </option>
                                        <?php endforeach; ?>
                                    </select>
                                    <code>[hg_beskeder]</code>
                                </td>
                            </tr>
                            <tr>
                                <th>Nulstil kode side</th>
                                <td>
                                    <select name="hg_page_reset_password">
                                        <option value="">-- Valg side --</option>
                                        <?php foreach ($pages as $page): ?>
                                        <option value="<?php echo $page->ID; ?>" <?php selected(get_option('hg_page_reset_password'), $page->ID); ?>>
                                            <?php echo esc_html($page->post_title); ?>
                                        </option>
                                        <?php endforeach; ?>
                                    </select>
                                    <code>[hg_nulstil_kode]</code>
                                </td>
                            </tr>
                            <tr>
                                <th>Opret tabt URL</th>
                                <td>
                                    <input type="text" name="hg_page_create_lost" value="<?php echo esc_attr(get_option('hg_page_create_lost', '/tabt')); ?>" class="regular-text">
                                </td>
                            </tr>
                            <tr>
                                <th>Opret fundet URL</th>
                                <td>
                                    <input type="text" name="hg_page_create_found" value="<?php echo esc_attr(get_option('hg_page_create_found', '/fundet')); ?>" class="regular-text">
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>

                <!-- Email Tab -->
                <div class="hg-settings-section <?php echo $current_tab === 'email' ? 'hg-settings-section--active' : ''; ?>">
                    <div class="hg-admin-card">
                        <h2>Email indstillinger</h2>

                        <table class="form-table">
                            <tr>
                                <th>Support email</th>
                                <td>
                                    <input type="email" name="hg_support_email" value="<?php echo esc_attr(get_option('hg_support_email', 'support@greydot.dk')); ?>" class="regular-text">
                                    <p class="description">Email hvor support beskeder sendes til</p>
                                </td>
                            </tr>
                            <tr>
                                <th>Afsender email</th>
                                <td>
                                    <input type="email" name="hg_from_email" value="<?php echo esc_attr(get_option('hg_from_email', 'hittegodscentralen@greydot.dk')); ?>" class="regular-text">
                                    <p class="description">Email der vises som afsender</p>
                                </td>
                            </tr>
                            <tr>
                                <th>Afsender navn</th>
                                <td>
                                    <input type="text" name="hg_from_name" value="<?php echo esc_attr(get_option('hg_from_name', 'Hittegodscentralen')); ?>" class="regular-text">
                                </td>
                            </tr>
                        </table>

                        <p><a href="<?php echo admin_url('admin.php?page=hg-email-templates'); ?>" class="button">Rediger email skabeloner</a></p>
                    </div>
                </div>

                <!-- Security Tab -->
                <div class="hg-settings-section <?php echo $current_tab === 'security' ? 'hg-settings-section--active' : ''; ?>">
                    <div class="hg-admin-card">
                        <h2>Rate Limiting</h2>
                        <p>Begraens antal handlinger for at forebygge misbrug.</p>

                        <table class="form-table">
                            <tr>
                                <th>Beskeder per time</th>
                                <td>
                                    <input type="number" name="hg_rate_limit_messages" min="1" max="100"
                                           value="<?php echo esc_attr(get_option('hg_rate_limit_messages', 10)); ?>" class="small-text">
                                    <p class="description">Maks antal beskeder en bruger kan sende per time</p>
                                </td>
                            </tr>
                            <tr>
                                <th>Opslag per dag</th>
                                <td>
                                    <input type="number" name="hg_rate_limit_posts" min="1" max="50"
                                           value="<?php echo esc_attr(get_option('hg_rate_limit_posts', 5)); ?>" class="small-text">
                                    <p class="description">Maks antal opslag en bruger kan oprette per dag</p>
                                </td>
                            </tr>
                            <tr>
                                <th>Login forsog for lockout</th>
                                <td>
                                    <input type="number" name="hg_rate_limit_login" min="3" max="20"
                                           value="<?php echo esc_attr(get_option('hg_rate_limit_login', 5)); ?>" class="small-text">
                                </td>
                            </tr>
                            <tr>
                                <th>Lockout varighed (minutter)</th>
                                <td>
                                    <input type="number" name="hg_lockout_duration" min="5" max="1440"
                                           value="<?php echo esc_attr(get_option('hg_lockout_duration', 15)); ?>" class="small-text">
                                </td>
                            </tr>
                        </table>
                    </div>

                    <div class="hg-admin-card">
                        <h2>Adgangskontrol</h2>

                        <table class="form-table">
                            <tr>
                                <th>Bloker wp-admin</th>
                                <td>
                                    <label>
                                        <input type="checkbox" name="hg_block_wp_admin" value="1" <?php checked(get_option('hg_block_wp_admin', 1), 1); ?>>
                                        Bloker brugere fra at tilga WordPress admin
                                    </label>
                                </td>
                            </tr>
                            <tr>
                                <th>Tillad gaeste-opslag</th>
                                <td>
                                    <label>
                                        <input type="checkbox" name="hg_allow_guest_posts" value="1" <?php checked(get_option('hg_allow_guest_posts', 0), 1); ?>>
                                        Tillad oprettelse af opslag uden login
                                    </label>
                                </td>
                            </tr>
                            <tr>
                                <th>Gaeste-opslag krav</th>
                                <td>
                                    <label>
                                        <input type="checkbox" name="hg_guest_require_contact" value="1" <?php checked(get_option('hg_guest_require_contact', 1), 1); ?>>
                                        Krav om kontaktoplysninger (email/telefon) for gaeste-opslag
                                    </label>
                                </td>
                            </tr>
                        </table>
                    </div>

                    <div class="hg-admin-card">
                        <h2>Token udlobstider</h2>

                        <table class="form-table">
                            <tr>
                                <th>Password reset token (timer)</th>
                                <td>
                                    <input type="number" name="hg_token_expiry_hours" min="1" max="168"
                                           value="<?php echo esc_attr(get_option('hg_token_expiry_hours', 24)); ?>" class="small-text">
                                </td>
                            </tr>
                            <tr>
                                <th>Login session (dage)</th>
                                <td>
                                    <input type="number" name="hg_session_expiry_days" min="1" max="365"
                                           value="<?php echo esc_attr(get_option('hg_session_expiry_days', 14)); ?>" class="small-text">
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>

                <!-- Automation Tab -->
                <div class="hg-settings-section <?php echo $current_tab === 'automation' ? 'hg-settings-section--active' : ''; ?>">
                    <div class="hg-admin-card">
                        <h2>Auto-luk opslag</h2>

                        <table class="form-table">
                            <tr>
                                <th>Auto-luk efter</th>
                                <td>
                                    <select name="hg_auto_close_days">
                                        <option value="0" <?php selected(get_option('hg_auto_close_days', 0), 0); ?>>Aldrig (deaktiveret)</option>
                                        <option value="30" <?php selected(get_option('hg_auto_close_days', 0), 30); ?>>30 dage</option>
                                        <option value="60" <?php selected(get_option('hg_auto_close_days', 0), 60); ?>>60 dage</option>
                                        <option value="90" <?php selected(get_option('hg_auto_close_days', 0), 90); ?>>90 dage</option>
                                        <option value="180" <?php selected(get_option('hg_auto_close_days', 0), 180); ?>>180 dage</option>
                                        <option value="365" <?php selected(get_option('hg_auto_close_days', 0), 365); ?>>1 ar</option>
                                    </select>
                                    <p class="description">Lukker automatisk opslag der er aeldre end dette</p>
                                </td>
                            </tr>
                            <tr>
                                <th>Pamindelse for lukning</th>
                                <td>
                                    <label>
                                        <input type="checkbox" name="hg_send_expiry_reminder" value="1" <?php checked(get_option('hg_send_expiry_reminder', 0), 1); ?>>
                                        Send email for opslag lukkes
                                    </label>
                                    <br><br>
                                    <input type="number" name="hg_reminder_days_before" min="1" max="30"
                                           value="<?php echo esc_attr(get_option('hg_reminder_days_before', 7)); ?>" class="small-text"> dage for
                                </td>
                            </tr>
                        </table>
                    </div>

                    <div class="hg-admin-card">
                        <h2>Oprydning</h2>

                        <table class="form-table">
                            <tr>
                                <th>Slet lukkede opslag efter</th>
                                <td>
                                    <select name="hg_delete_closed_after">
                                        <option value="0" <?php selected(get_option('hg_delete_closed_after', 0), 0); ?>>Aldrig (behold)</option>
                                        <option value="90" <?php selected(get_option('hg_delete_closed_after', 0), 90); ?>>90 dage</option>
                                        <option value="180" <?php selected(get_option('hg_delete_closed_after', 0), 180); ?>>180 dage</option>
                                        <option value="365" <?php selected(get_option('hg_delete_closed_after', 0), 365); ?>>1 ar</option>
                                    </select>
                                    <p class="description">Sletter permanent lukkede opslag efter dette tidsrum</p>
                                </td>
                            </tr>
                        </table>
                    </div>

                    <div class="hg-admin-card">
                        <h2>Planlagte jobs</h2>
                        <table class="widefat">
                            <thead>
                                <tr>
                                    <th>Job</th>
                                    <th>Status</th>
                                    <th>Naeste korsel</th>
                                    <th>Handling</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($cron_status as $job_id => $job): ?>
                                <tr>
                                    <td><?php echo esc_html($job['name']); ?></td>
                                    <td>
                                        <span class="hg-cron-status hg-cron-status--<?php echo $job['enabled'] ? 'active' : 'inactive'; ?>">
                                            <?php echo $job['enabled'] ? 'Aktiv' : 'Deaktiveret'; ?>
                                        </span>
                                    </td>
                                    <td>
                                        <?php echo $job['next_run'] ? date('d/m/Y H:i', $job['next_run']) : '-'; ?>
                                    </td>
                                    <td>
                                        <button type="button" class="button button-small hg-run-cron" data-job="<?php echo $job_id; ?>">
                                            Kor nu
                                        </button>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Notifications Tab -->
                <div class="hg-settings-section <?php echo $current_tab === 'notifications' ? 'hg-settings-section--active' : ''; ?>">
                    <div class="hg-admin-card">
                        <h2>Admin notifikationer</h2>
                        <p>Modtag email nar disse haendelser sker.</p>

                        <table class="form-table">
                            <tr>
                                <th>Ny bruger registrering</th>
                                <td>
                                    <label>
                                        <input type="checkbox" name="hg_notify_new_user" value="1" <?php checked(get_option('hg_notify_new_user', 0), 1); ?>>
                                        Send email til admin nar en ny bruger registrerer sig
                                    </label>
                                </td>
                            </tr>
                            <tr>
                                <th>Nyt opslag</th>
                                <td>
                                    <label>
                                        <input type="checkbox" name="hg_notify_new_post" value="1" <?php checked(get_option('hg_notify_new_post', 0), 1); ?>>
                                        Send email til admin nar et nyt opslag oprettes
                                    </label>
                                </td>
                            </tr>
                            <tr>
                                <th>Opslag lukket</th>
                                <td>
                                    <label>
                                        <input type="checkbox" name="hg_notify_post_closed" value="1" <?php checked(get_option('hg_notify_post_closed', 0), 1); ?>>
                                        Send email til admin nar et opslag lukkes/loses
                                    </label>
                                </td>
                            </tr>
                        </table>
                    </div>

                    <div class="hg-admin-card">
                        <h2>Bruger funktioner</h2>

                        <table class="form-table">
                            <tr>
                                <th>Bruger-til-bruger beskeder</th>
                                <td>
                                    <label>
                                        <input type="checkbox" name="hg_enable_user_messages" value="1" <?php checked(get_option('hg_enable_user_messages', 1), 1); ?>>
                                        Tillad brugere at sende beskeder til hinanden
                                    </label>
                                </td>
                            </tr>
                            <tr>
                                <th>Social login</th>
                                <td>
                                    <label>
                                        <input type="checkbox" name="hg_enable_social_login" value="1" <?php checked(get_option('hg_enable_social_login', 0), 1); ?>>
                                        Vis Google/Facebook login knapper
                                    </label>
                                    <p class="description">Kraever yderligere opsaetning med OAuth</p>
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>

                <!-- Shortcodes Tab -->
                <div class="hg-settings-section <?php echo $current_tab === 'shortcodes' ? 'hg-settings-section--active' : ''; ?>">
                    <div class="hg-admin-card">
                        <h2>Shortcode oversigt</h2>
                        <table class="widefat">
                            <thead>
                                <tr>
                                    <th>Shortcode</th>
                                    <th>Beskrivelse</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td><code>[hg_login_form]</code></td><td>Login og registreringsformular</td></tr>
                                <tr><td><code>[hg_dashboard]</code></td><td>Bruger dashboard med statistik og overblik</td></tr>
                                <tr><td><code>[hg_mine_opslag]</code></td><td>Liste over brugerens opslag</td></tr>
                                <tr><td><code>[hg_rediger_opslag]</code></td><td>Formular til at redigere opslag (kraever ?id=XX)</td></tr>
                                <tr><td><code>[hg_support]</code></td><td>Support side med besked formular</td></tr>
                                <tr><td><code>[hg_beskeder]</code></td><td>Brugerens indbakke med beskeder</td></tr>
                                <tr><td><code>[hg_nulstil_kode]</code></td><td>Nulstil password formular</td></tr>
                                <tr><td><code>[hg_kontakt_bruger]</code></td><td>Kontaktformular til opslags ejer</td></tr>
                                <tr><td><code>[hg_bruger_navn]</code></td><td>Viser brugerens fornavn</td></tr>
                                <tr><td><code>[hg_bruger_email]</code></td><td>Viser brugerens email</td></tr>
                                <tr><td><code>[hg_statistik]</code></td><td>Viser brugerens statistik inline</td></tr>
                                <tr><td><code>[hg_log_ud_link]</code></td><td>Log ud link</td></tr>
                                <tr><td><code>[hg_hvis_logget_ind]...[/hg_hvis_logget_ind]</code></td><td>Viser indhold kun for logged-in brugere</td></tr>
                                <tr><td><code>[hg_hvis_logget_ud]...[/hg_hvis_logget_ud]</code></td><td>Viser indhold kun for logged-out brugere</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <?php if ($current_tab !== 'shortcodes'): ?>
                    <?php submit_button('Gem indstillinger'); ?>
                <?php endif; ?>
            </form>
        </div>

        <script>
        jQuery(document).ready(function($) {
            // Show active tab section
            $('.hg-settings-section').hide();
            $('.hg-settings-section--active').show();

            // Run cron manually
            $('.hg-run-cron').on('click', function() {
                var btn = $(this);
                var job = btn.data('job');

                btn.prop('disabled', true).text('Korer...');

                $.ajax({
                    url: hgAdmin.ajaxUrl,
                    method: 'POST',
                    data: {
                        action: 'hg_run_manual_cron',
                        nonce: hgAdmin.nonce,
                        job: job
                    },
                    success: function(response) {
                        if (response.success) {
                            alert(response.data.message);
                        } else {
                            alert(response.data.message || 'Fejl');
                        }
                        btn.prop('disabled', false).text('Kor nu');
                    },
                    error: function() {
                        alert('Der opstod en fejl');
                        btn.prop('disabled', false).text('Kor nu');
                    }
                });
            });
        });
        </script>
        <?php
    }
    
    /**
     * AJAX: Reply to support message
     */
    public function ajax_reply_support() {
        check_ajax_referer('hg_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Ingen adgang']);
        }
        
        global $wpdb;
        
        $message_id = intval($_POST['message_id']);
        $reply = sanitize_textarea_field($_POST['reply']);
        
        if (empty($reply)) {
            wp_send_json_error(['message' => 'Skriv et svar']);
        }
        
        $table = $wpdb->prefix . 'hg_support_messages';
        
        // Get original message
        $message = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", $message_id));
        
        if (!$message) {
            wp_send_json_error(['message' => 'Besked ikke fundet']);
        }
        
        // Update message
        $wpdb->update(
            $table,
            [
                'admin_reply' => $reply,
                'status' => 'replied',
                'updated_at' => current_time('mysql'),
            ],
            ['id' => $message_id],
            ['%s', '%s', '%s'],
            ['%d']
        );
        
        // Send email to user
        $user = get_userdata($message->user_id);
        if ($user) {
            $first_name = get_user_meta($user->ID, 'first_name', true);
            if (empty($first_name)) {
                $first_name = $user->display_name ?: explode('@', $user->user_email)[0];
            }

            // Nyt design via skabelon-systemet (samme layout + reklame som brugermails)
            $sent = false;
            if (class_exists('HG_Email_Templates')) {
                $sent = HG_Email_Templates::send('support_reply', $user->user_email, [
                    'user_name'        => $first_name,
                    'reply_message'    => nl2br(esc_html($reply)),
                    'original_message' => nl2br(esc_html($message->message)),
                ]);
            }

            if (!$sent) {
                // Fallback: gammelt direkte design
                $subject = 'Svar på din henvendelse - Hittegodscentralen';
                $body = '
                    <!DOCTYPE html>
                    <html>
                    <head><meta charset="UTF-8"></head>
                    <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1e3a5f;">
                        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background: linear-gradient(135deg, #7ecec2, #5cb8aa); padding: 20px; border-radius: 12px 12px 0 0;">
                                <h2 style="color: white; margin: 0;">Svar på din henvendelse</h2>
                            </div>
                            <div style="background: #fff; padding: 25px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                                <p>Hej!</p>
                                <p>Vi har svaret på din henvendelse:</p>
                                <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #7ecec2; margin: 20px 0;">
                                    ' . nl2br(esc_html($reply)) . '
                                </div>
                                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                                <p style="color: #64748b; font-size: 14px;">
                                    <strong>Din oprindelige besked:</strong><br>
                                    ' . nl2br(esc_html($message->message)) . '
                                </p>
                            </div>
                        </div>
                    </body>
                    </html>
                ';

                $headers = ['Content-Type: text/html; charset=UTF-8'];
                wp_mail($user->user_email, $subject, $body, $headers);
            }
        }
        
        wp_send_json_success(['message' => 'Svar sendt!']);
    }
    
    /**
     * AJAX: Get user details
     */
    public function ajax_get_user_details() {
        check_ajax_referer('hg_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Ingen adgang']);
        }
        
        global $wpdb;
        
        $user_id = intval($_GET['user_id']);
        $user = get_userdata($user_id);
        
        if (!$user) {
            wp_send_json_error(['message' => 'Bruger ikke fundet']);
        }
        
        // Get posts
        $posts = $wpdb->get_results($wpdb->prepare("
            SELECT p.*, pm.meta_value as status
            FROM {$wpdb->posts} p
            LEFT JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id AND pm.meta_key = '_lost_found_status'
            WHERE p.post_author = %d AND p.post_type = 'product'
            ORDER BY p.post_date DESC
            LIMIT 10
        ", $user_id));
        
        // Get support messages count
        $support_table = $wpdb->prefix . 'hg_support_messages';
        $support_count = 0;
        if ($wpdb->get_var("SHOW TABLES LIKE '$support_table'") === $support_table) {
            $support_count = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$support_table} WHERE user_id = %d", $user_id));
        }
        
        $html = '<h2>' . esc_html(get_user_meta($user_id, 'first_name', true) ?: $user->display_name) . '</h2>';
        $html .= '<p><strong>Email:</strong> ' . esc_html($user->user_email) . '</p>';
        $html .= '<p><strong>Registreret:</strong> ' . date('d/m/Y H:i', strtotime($user->user_registered)) . '</p>';
        $html .= '<p><strong>Seneste login:</strong> ' . (get_user_meta($user_id, '_hg_last_login', true) ?: 'Aldrig') . '</p>';
        $html .= '<p><strong>Support beskeder:</strong> ' . $support_count . '</p>';
        
        $html .= '<h3>Opslag (' . count($posts) . ')</h3>';
        if (!empty($posts)) {
            $html .= '<ul>';
            foreach ($posts as $post) {
                $status_label = $post->status === 'tabt' ? 'Tabt' : ($post->status === 'fundet' ? 'Fundet' : 'Lukket');
                $html .= '<li><a href="' . get_edit_post_link($post->ID) . '">' . esc_html($post->post_title) . '</a> - ' . $status_label . '</li>';
            }
            $html .= '</ul>';
        } else {
            $html .= '<p>Ingen opslag.</p>';
        }
        
        $html .= '<p><a href="' . admin_url('user-edit.php?user_id=' . $user_id) . '" class="button">Rediger bruger</a></p>';
        
        wp_send_json_success(['html' => $html]);
    }

    /**
     * AJAX: Delete HGB Business item from admin
     */
    public function ajax_delete_hgb_item() {
        check_ajax_referer('hg_admin_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Ingen adgang']);
        }

        $item_id = intval($_POST['item_id'] ?? 0);
        if (!$item_id) {
            wp_send_json_error(['message' => 'Ugyldigt ID']);
        }

        $config = ABSPATH . 'hg-business/config.php';
        $db = ABSPATH . 'hg-business/db.php';
        if (!file_exists($config) || !file_exists($db)) {
            wp_send_json_error(['message' => 'HGB ikke tilgængelig']);
        }

        require_once $config;
        require_once $db;

        try {
            HGB_DB::delete('hgb_contacts', 'item_id = ?', [$item_id]);
            HGB_DB::delete('hgb_items', 'id = ?', [$item_id]);
            wp_send_json_success(['message' => 'Opslag slettet']);
        } catch (Exception $e) {
            wp_send_json_error(['message' => 'Kunne ikke slette: ' . $e->getMessage()]);
        }
    }

    /**
     * AJAX: Bulk actions for posts
     */
    public function ajax_bulk_posts() {
        check_ajax_referer('hg_admin_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Ingen adgang']);
        }

        $action = sanitize_text_field($_POST['bulk_action'] ?? '');
        $post_ids = array_map('intval', $_POST['post_ids'] ?? []);

        if (empty($post_ids)) {
            wp_send_json_error(['message' => 'Ingen opslag valgt']);
        }

        $count = 0;

        switch ($action) {
            case 'close':
                foreach ($post_ids as $post_id) {
                    update_post_meta($post_id, '_lost_found_status', 'lukket');
                    update_post_meta($post_id, '_lf_closed_at', current_time('mysql'));
                    $count++;
                }
                wp_send_json_success(['message' => $count . ' opslag lukket']);
                break;

            case 'status_tabt':
                foreach ($post_ids as $post_id) {
                    update_post_meta($post_id, '_lost_found_status', 'tabt');
                    $count++;
                }
                wp_send_json_success(['message' => $count . ' opslag sat til Tabt']);
                break;

            case 'status_fundet':
                foreach ($post_ids as $post_id) {
                    update_post_meta($post_id, '_lost_found_status', 'fundet');
                    $count++;
                }
                wp_send_json_success(['message' => $count . ' opslag sat til Fundet']);
                break;

            case 'delete':
                foreach ($post_ids as $post_id) {
                    wp_trash_post($post_id);
                    $count++;
                }
                wp_send_json_success(['message' => $count . ' opslag slettet']);
                break;

            default:
                wp_send_json_error(['message' => 'Ugyldig handling']);
        }
    }

    /**
     * AJAX: Bulk actions for users
     */
    public function ajax_bulk_users() {
        check_ajax_referer('hg_admin_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Ingen adgang']);
        }

        $action = sanitize_text_field($_POST['bulk_action'] ?? '');
        $user_ids = array_map('intval', $_POST['user_ids'] ?? []);

        if (empty($user_ids)) {
            wp_send_json_error(['message' => 'Ingen brugere valgt']);
        }

        switch ($action) {
            case 'email':
                // Return user emails for email client
                $emails = [];
                foreach ($user_ids as $user_id) {
                    $user = get_userdata($user_id);
                    if ($user) {
                        $emails[] = $user->user_email;
                    }
                }
                wp_send_json_success([
                    'action' => 'email',
                    'emails' => $emails,
                    'mailto' => 'mailto:' . implode(',', $emails),
                ]);
                break;

            case 'export':
                // Generate CSV data
                $csv_data = HG_Export::get_users_csv_data($user_ids);
                wp_send_json_success([
                    'action' => 'export',
                    'csv' => $csv_data,
                    'filename' => 'brugere-eksport-' . date('Y-m-d') . '.csv',
                ]);
                break;

            default:
                wp_send_json_error(['message' => 'Ugyldig handling']);
        }
    }
}

// Initialize
HG_Admin::instance();
