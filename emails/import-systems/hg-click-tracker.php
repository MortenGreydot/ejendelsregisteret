<?php
/**
 * Plugin Name: HG Click Tracker
 * Description: Tæller klik fra Hittegodscentralen-mails videre til Ejendelsregisteret. Endpoint: /k/?m=<mailtype>&l=<link-id>. Redirect sker altid — også hvis logning fejler. Ingen rå IP gemmes.
 * Version: 1.0.0
 * Author: Greydot
 */

if (!defined('ABSPATH')) exit;

define('HG_CLK_VER', '1.0.0');
define('HG_CLK_RETENTION_DAYS', 180);
define('HG_CLK_DEDUPE_MINUTES', 30);
define('HG_CLK_UTM', true);

class HG_Click_Tracker {

    /** Standard-destination når link-id'et er ukendt eller mangler. */
    const FALLBACK = 'https://ejendelsregisteret.dk/';

    /* ------------------------------------------------------------ tabeller */

    public static function maybe_install() {
        if (get_option('hg_clk_ver') === HG_CLK_VER) return;

        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $charset = $wpdb->get_charset_collate();

        dbDelta("CREATE TABLE {$wpdb->prefix}hgclk_events (
            id bigint unsigned NOT NULL AUTO_INCREMENT,
            ts datetime NOT NULL,
            day date NOT NULL,
            mail_type varchar(32) NOT NULL DEFAULT '',
            link_id varchar(24) NOT NULL DEFAULT '',
            dest varchar(191) NOT NULL DEFAULT '',
            vhash char(32) NOT NULL DEFAULT '',
            device varchar(16) NOT NULL DEFAULT '',
            bot tinyint(1) NOT NULL DEFAULT 0,
            bot_tag varchar(24) NOT NULL DEFAULT '',
            PRIMARY KEY  (id),
            UNIQUE KEY vhash (vhash),
            KEY day (day),
            KEY mt (mail_type,link_id)
        ) $charset;");

        dbDelta("CREATE TABLE {$wpdb->prefix}hgclk_daily (
            day date NOT NULL,
            mail_type varchar(32) NOT NULL,
            link_id varchar(24) NOT NULL,
            clicks int unsigned NOT NULL DEFAULT 0,
            bots int unsigned NOT NULL DEFAULT 0,
            PRIMARY KEY  (day,mail_type,link_id)
        ) $charset;");

        update_option('hg_clk_ver', HG_CLK_VER);
    }

    /* ------------------------------------------------------ destinationer */

    /**
     * Whitelist. Dette er den ENESTE kilde til destinationer — der accepteres
     * aldrig en URL fra query-strengen, så endpointet kan ikke misbruges
     * som open redirect.
     */
    public static function destinations() {
        return [
            'signup'    => 'https://ejendelsregisteret.dk/opret-mail/',
            'remind'    => 'https://ejendelsregisteret.dk/',
            'privacy'   => 'https://hittegodscentralen.dk/privatlivspolitik',
            'support'   => 'https://hittegodscentralen.dk/support',
            'feedback'  => 'https://hittegodscentralen.dk/support/',
            'dashboard' => 'https://hittegodscentralen.dk/min-side/',
            'inbox'     => 'https://hittegodscentralen.dk/beskeder/',
        ];
    }

    /**
     * Domaener der maa redirectes til naar destinationen kommer fra et dynamisk
     * link (parameter "u") i stedet for whitelisten ovenfor — se validate_dynamic_url().
     */
    public static function allowed_hosts() {
        return [
            'hittegodscentralen.dk', 'www.hittegodscentralen.dk',
            'ejendelsregisteret.dk', 'www.ejendelsregisteret.dk',
        ];
    }

    /**
     * Tillader kun dynamiske links til egne domaener (host-whitelist) — aldrig et
     * vilkaarligt eksternt maal. Returnerer null hvis $url ikke bestaar validering.
     */
    private static function validate_dynamic_url($url) {
        if ($url === '') return null;
        $parts = wp_parse_url($url);
        if (empty($parts['scheme']) || empty($parts['host'])) return null;
        if (!in_array(strtolower($parts['scheme']), ['http', 'https'], true)) return null;
        if (!in_array(strtolower($parts['host']), self::allowed_hosts(), true)) return null;
        return esc_url_raw($url);
    }

    public static function resolve_dest($link_id, $mail_type = '', $dynamic_url = '') {
        if ($dynamic_url !== '') {
            $validated = self::validate_dynamic_url($dynamic_url);
            $url = $validated !== null ? $validated : self::FALLBACK;
        } else {
            $map = self::destinations();
            $url = isset($map[$link_id]) ? $map[$link_id] : self::FALLBACK;
        }

        if (HG_CLK_UTM) {
            $args = [
                'utm_source' => 'hittegodscentralen',
                'utm_medium' => 'email',
            ];
            if ($mail_type !== '') $args['utm_campaign'] = $mail_type;
            if ($link_id !== '')   $args['utm_content']  = $link_id;
            $url = add_query_arg($args, $url);
        }

        return $url;
    }

    /* ------------------------------------------------------------ bot-tag */

    /**
     * Returnerer '' for et menneske, ellers en kort tag-streng.
     * Bot-hits redirectes stadig — de tælles bare separat.
     */
    public static function bot_tag() {
        $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';
        if ($method !== 'GET') return 'head';

        foreach (['HTTP_PURPOSE' => 'prefetch', 'HTTP_X_PURPOSE' => 'preview', 'HTTP_SEC_PURPOSE' => 'prefetch', 'HTTP_X_MOZ' => 'prefetch'] as $key => $needle) {
            if (!empty($_SERVER[$key]) && stripos($_SERVER[$key], $needle) !== false) return 'prefetch';
        }

        $ua = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';
        if ($ua === '') return 'noua';

        $rules = [
            'safelinks'   => '/SafeLinks|Outlook\-|Microsoft Office|ms\-office|BingPreview/i',
            'mailproxy'   => '/GoogleImageProxy|YahooMailProxy|Superhuman/i',
            'mailscanner' => '/proofpoint|mimecast|barracuda|symantec|forcepoint|zscaler|ironport|trend ?micro|sophos|cloudmark|messagelabs/i',
            'unfurl'      => '/Slackbot|Twitterbot|Discordbot|TelegramBot|WhatsApp|facebookexternalhit|LinkedInBot|Skype/i',
            'generic'     => '/bot|crawl|spider|slurp|curl|wget|python|Go-http-client|Java\/|okhttp|axios|node-fetch|Guzzle|Apache-HttpClient|libwww|Scrapy|headless|phantomjs|monitor|pingdom|lighthouse|preview/i',
        ];
        foreach ($rules as $tag => $re) {
            if (preg_match($re, $ua)) return $tag;
        }

        return '';
    }

    private static function device() {
        $ua = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';
        return preg_match('/Mobile|Android|iPhone|iPad|iPod|Windows Phone/i', $ua) ? 'mobil' : 'desktop';
    }

    /**
     * GDPR: IP og user-agent forlader aldrig dette request. Hashen er nøglet med
     * en site-hemmelighed OG en tidsbucket, så den hverken kan vendes om eller
     * kædes sammen på tværs af tid. Bucket'en er samtidig dedupe-vinduet.
     */
    private static function visitor_hash($m, $l) {
        $ip  = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
        $ua  = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';
        $bkt = (int) floor(time() / (HG_CLK_DEDUPE_MINUTES * 60));
        return substr(hash_hmac('sha256', $ip . '|' . $ua . '|' . $m . '|' . $l . '|' . $bkt, wp_salt('hg_clk')), 0, 32);
    }

    /* ------------------------------------------------------------ logning */

    private static function log($m, $l, $dest, $tag) {
        global $wpdb;

        $events = $wpdb->prefix . 'hgclk_events';
        $daily  = $wpdb->prefix . 'hgclk_daily';
        $now    = current_time('mysql');
        $day    = substr($now, 0, 10);
        $is_bot = $tag !== '' ? 1 : 0;

        // INSERT IGNORE mod UNIQUE KEY(vhash): MySQL afviser dubletten atomisk,
        // så der er ingen race mellem to samtidige klik.
        $inserted = $wpdb->query($wpdb->prepare(
            "INSERT IGNORE INTO {$events} (ts,day,mail_type,link_id,dest,vhash,device,bot,bot_tag)
             VALUES (%s,%s,%s,%s,%s,%s,%s,%d,%s)",
            $now, $day, $m, $l, substr($dest, 0, 191), self::visitor_hash($m, $l), self::device(), $is_bot, $tag
        ));

        if (!$inserted) return; // dublet inden for dedupe-vinduet

        $wpdb->query($wpdb->prepare(
            "INSERT INTO {$daily} (day,mail_type,link_id,clicks,bots) VALUES (%s,%s,%s,%d,%d)
             ON DUPLICATE KEY UPDATE clicks = clicks + VALUES(clicks), bots = bots + VALUES(bots)",
            $day, $m, $l, $is_bot ? 0 : 1, $is_bot ? 1 : 0
        ));
    }

    /* ----------------------------------------------------------- endpoint */

    public static function handle() {
        $m = substr(preg_replace('/[^a-z0-9_]/', '', strtolower((string) (isset($_GET['m']) ? $_GET['m'] : ''))), 0, 32);
        $l = substr(preg_replace('/[^a-z0-9_]/', '', strtolower((string) (isset($_GET['l']) ? $_GET['l'] : ''))), 0, 24);
        $u = isset($_GET['u']) ? (string) wp_unslash($_GET['u']) : '';

        // 1) Destinationen bestemmes først og kan ikke fejle.
        $dest = self::resolve_dest($l, $m, $u);

        // 2) Logningen må gerne fejle — brugeren skal videre uanset hvad.
        try {
            self::log($m, $l, $dest, self::bot_tag());
        } catch (Exception $e) {
            // tavs
        } catch (Error $e) {
            // tavs
        }

        // 3) Redirect sker altid.
        nocache_headers();
        header('X-Robots-Tag: noindex, nofollow, noarchive');
        wp_redirect($dest, 302);
        exit;
    }

    /* -------------------------------------------------------- oprydning */

    public static function cleanup() {
        global $wpdb;
        $events = $wpdb->prefix . 'hgclk_events';
        $wpdb->query($wpdb->prepare(
            "DELETE FROM {$events} WHERE day < DATE_SUB(CURDATE(), INTERVAL %d DAY)",
            HG_CLK_RETENTION_DAYS
        ));
    }

    /**
     * Sletter al hidtidig klik-data (fx gamle test-/probe-hits), så statistikken
     * kun indeholder klik fra herefter. Kræver manage_options + gyldig nonce.
     */
    private static function maybe_handle_reset() {
        if (!isset($_POST['hg_clk_reset']) || !current_user_can('manage_options')) return;
        check_admin_referer('hg_clk_reset');

        global $wpdb;
        $wpdb->query("TRUNCATE TABLE {$wpdb->prefix}hgclk_events");
        $wpdb->query("TRUNCATE TABLE {$wpdb->prefix}hgclk_daily");

        wp_safe_redirect(remove_query_arg('_reset', add_query_arg('cleared', '1')));
        exit;
    }

    /* ------------------------------------------------------- admin-side */

    public static function admin_menu() {
        $parent = menu_page_url('hg-dashboard', false) ? 'hg-dashboard' : 'tools.php';
        add_submenu_page($parent, 'Mail-klik', 'Mail-klik', 'manage_options', 'hg-mail-clicks', [__CLASS__, 'render_admin_page']);
    }

    private static function sum_since($days) {
        global $wpdb;
        $daily = $wpdb->prefix . 'hgclk_daily';
        if ($days === 0) {
            return (int) $wpdb->get_var("SELECT COALESCE(SUM(clicks),0) FROM {$daily}");
        }
        return (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COALESCE(SUM(clicks),0) FROM {$daily} WHERE day >= DATE_SUB(CURDATE(), INTERVAL %d DAY)",
            $days - 1
        ));
    }

    /**
     * Bygger mail-type x link-id matrix for en given kolonneliste. Naar
     * $catch_other er sand, samles alt der ikke matcher $cols under 'other'
     * (bruges til standard-tabellen); ellers springes de raekker bare over
     * (bruges til reklame-tabellen, saa den ikke blandes med andre klik).
     */
    private static function build_matrix($rows, $cols, $catch_other) {
        $matrix  = [];
        $col_tot = array_fill_keys(array_keys($cols), 0);
        $grand   = 0;
        foreach ((array) $rows as $r) {
            if (isset($cols[$r['link_id']])) {
                $li = $r['link_id'];
            } elseif ($catch_other) {
                $li = 'other';
            } else {
                continue;
            }
            $mt = $r['mail_type'] !== '' ? $r['mail_type'] : '(ukendt)';
            if (!isset($matrix[$mt])) $matrix[$mt] = array_fill_keys(array_keys($cols), 0);
            $matrix[$mt][$li] += (int) $r['clicks'];
            $col_tot[$li]     += (int) $r['clicks'];
            $grand            += (int) $r['clicks'];
        }
        ksort($matrix);
        return [$matrix, $col_tot, $grand];
    }

    /**
     * Render en enkelt klik-tabel (bruges til baade standard- og reklame-tabellen).
     */
    private static function render_matrix_table($title, $matrix, $cols, $col_tot, $grand, $names) {
        ?>
        <h2><?php echo esc_html($title); ?></h2>
        <table class="widefat striped" style="max-width:900px;">
            <thead>
                <tr>
                    <th>Mail</th>
                    <?php foreach ($cols as $lbl) : ?><th style="text-align:right;"><?php echo esc_html($lbl); ?></th><?php endforeach; ?>
                    <th style="text-align:right;">I alt</th>
                </tr>
            </thead>
            <tbody>
            <?php if (empty($matrix)) : ?>
                <tr><td colspan="<?php echo count($cols) + 2; ?>">Ingen klik registreret i perioden.</td></tr>
            <?php else : ?>
                <?php foreach ($matrix as $mt => $vals) : $row_tot = array_sum($vals); ?>
                    <tr>
                        <td><strong><?php echo esc_html(isset($names[$mt]) ? $names[$mt] : $mt); ?></strong><br>
                            <span style="color:#888;font-size:11px;"><?php echo esc_html($mt); ?></span></td>
                        <?php foreach (array_keys($cols) as $c) : ?>
                            <td style="text-align:right;"><?php echo $vals[$c] ? number_format_i18n($vals[$c]) : '<span style="color:#ccc;">0</span>'; ?></td>
                        <?php endforeach; ?>
                        <td style="text-align:right;"><strong><?php echo number_format_i18n($row_tot); ?></strong></td>
                    </tr>
                <?php endforeach; ?>
                <tr style="background:#f0f6fa;">
                    <td><strong>I alt</strong></td>
                    <?php foreach (array_keys($cols) as $c) : ?>
                        <td style="text-align:right;"><strong><?php echo number_format_i18n($col_tot[$c]); ?></strong></td>
                    <?php endforeach; ?>
                    <td style="text-align:right;"><strong><?php echo number_format_i18n($grand); ?></strong></td>
                </tr>
            <?php endif; ?>
            </tbody>
        </table>
        <?php
    }

    public static function render_admin_page() {
        if (!current_user_can('manage_options')) return;

        self::maybe_handle_reset();

        global $wpdb;
        $daily  = $wpdb->prefix . 'hgclk_daily';
        $events = $wpdb->prefix . 'hgclk_events';

        $days  = isset($_GET['days']) ? (int) $_GET['days'] : 30;
        if (!in_array($days, [3, 7, 30, 90, 0], true)) $days = 30;
        $where = $days === 0 ? '' : $wpdb->prepare('WHERE day >= DATE_SUB(CURDATE(), INTERVAL %d DAY)', $days - 1);

        $rows = $wpdb->get_results("SELECT mail_type, link_id, SUM(clicks) AS clicks, SUM(bots) AS bots FROM {$daily} {$where} GROUP BY mail_type, link_id", ARRAY_A);

        // Reklame-knapperne (Ejendelsregisteret) holdes i deres egen tabel,
        // adskilt fra de almindelige transaktions-/service-knapper i mailene.
        $ad_cols = ['signup' => 'Opret dig', 'remind' => 'Påmind senere'];
        $std_cols = [
            'privacy' => 'Privatliv', 'support' => 'Support', 'feedback' => 'Feedback',
            'dashboard' => 'Gå til konto', 'inbox' => 'Indbakke', 'reset' => 'Nulstil kodeord',
            'unsubscribe' => 'Afmeld agent', 'results' => 'Søgeresultater',
            'view_item' => 'Se genstand', 'view_post' => 'Se opslag',
            'other' => 'Andet/ukendt',
        ];

        [$std_matrix, $std_col_tot, $std_grand] = self::build_matrix($rows, $std_cols, true);
        [$ad_matrix, $ad_col_tot, $ad_grand] = self::build_matrix($rows, $ad_cols, false);

        $names = [];
        if (class_exists('HG_Email_Templates')) {
            foreach (HG_Email_Templates::get_template_types() as $key => $def) {
                $names[$key] = $def['name'];
            }
        }

        $bots = $wpdb->get_results("SELECT bot_tag, COUNT(*) AS n FROM {$events} WHERE bot = 1 GROUP BY bot_tag ORDER BY n DESC", ARRAY_A);
        $bot_total = 0;
        foreach ((array) $bots as $b) $bot_total += (int) $b['n'];

        $recent = $wpdb->get_results("SELECT ts, mail_type, link_id, device, bot, bot_tag FROM {$events} ORDER BY id DESC LIMIT 20", ARRAY_A);

        $by_day = $wpdb->get_results("SELECT day, SUM(clicks) AS clicks FROM {$daily} {$where} GROUP BY day ORDER BY day ASC", ARRAY_A);
        $max_day = 0;
        foreach ((array) $by_day as $d) $max_day = max($max_day, (int) $d['clicks']);
        ?>
        <div class="wrap">
            <h1>Mail-klik til Ejendelsregisteret</h1>
            <p style="max-width:820px;color:#555;">
                Tæller klik på Ejendelsregisteret-links i Hittegodscentralens mails.
                Endpoint: <code><?php echo esc_html(home_url('/k/?m=…&l=…')); ?></code>.
                Mail-scannere og prefetch filtreres fra og tælles separat. Ingen IP-adresser gemmes.
            </p>

            <?php if (isset($_GET['cleared'])) : ?>
                <div class="notice notice-success is-dismissible"><p>Statistikken er nulstillet.</p></div>
            <?php endif; ?>

            <form method="post" style="margin:0 0 16px 0;">
                <?php wp_nonce_field('hg_clk_reset'); ?>
                <button type="submit" name="hg_clk_reset" value="1" class="button"
                        onclick="return confirm('Slet al klik-statistik indsamlet indtil nu? Kun nye klik tælles herefter. Kan ikke fortrydes.');">
                    🗑️ Ryd al hidtidig statistik
                </button>
            </form>

            <p>
                <?php foreach ([3 => 'Sidste 3 dage', 7 => 'Sidste 7 dage', 30 => 'Sidste 30 dage', 90 => 'Sidste 90 dage', 0 => 'Alle'] as $d => $lbl) : ?>
                    <a class="button <?php echo $days === $d ? 'button-primary' : ''; ?>"
                       href="<?php echo esc_url(add_query_arg('days', $d)); ?>"><?php echo esc_html($lbl); ?></a>
                <?php endforeach; ?>
            </p>

            <div style="display:flex;gap:14px;flex-wrap:wrap;margin:18px 0 26px 0;">
                <?php
                $cards = [
                    'I dag'          => self::sum_since(1),
                    'Sidste 7 dage'  => self::sum_since(7),
                    'Sidste 30 dage' => self::sum_since(30),
                    'Total'          => self::sum_since(0),
                ];
                foreach ($cards as $lbl => $val) : ?>
                    <div style="background:#fff;border:1px solid #dcdcde;border-radius:6px;padding:14px 20px;min-width:150px;">
                        <div style="font-size:12px;color:#777;text-transform:uppercase;letter-spacing:1px;"><?php echo esc_html($lbl); ?></div>
                        <div style="font-size:28px;font-weight:700;color:#2C658F;line-height:1.2;"><?php echo number_format_i18n($val); ?></div>
                    </div>
                <?php endforeach; ?>
            </div>

            <?php
            self::render_matrix_table('Standard mail-knapper', $std_matrix, $std_cols, $std_col_tot, $std_grand, $names);
            self::render_matrix_table('Reklame-knapper (Ejendelsregisteret)', $ad_matrix, $ad_cols, $ad_col_tot, $ad_grand, $names);
            ?>

            <h2 style="margin-top:30px;">Dag for dag</h2>
            <?php if (empty($by_day)) : ?>
                <p style="color:#888;">Ingen data endnu.</p>
            <?php else : ?>
                <div style="display:flex;align-items:flex-end;gap:3px;height:130px;max-width:900px;border-bottom:1px solid #ccc;padding-bottom:2px;">
                    <?php foreach ($by_day as $d) :
                        $h = $max_day > 0 ? max(2, round(((int) $d['clicks'] / $max_day) * 120)) : 2; ?>
                        <div title="<?php echo esc_attr($d['day'] . ': ' . $d['clicks'] . ' klik'); ?>"
                             style="flex:1;min-width:3px;height:<?php echo (int) $h; ?>px;background:#2C658F;"></div>
                    <?php endforeach; ?>
                </div>
                <p style="color:#888;font-size:12px;margin-top:4px;">
                    <?php echo esc_html($by_day[0]['day']); ?> &ndash; <?php echo esc_html($by_day[count($by_day) - 1]['day']); ?>
                    &middot; højeste dag: <?php echo number_format_i18n($max_day); ?> klik
                </p>
            <?php endif; ?>

            <h2 style="margin-top:30px;">Filtreret trafik (ikke talt med)</h2>
            <?php if (empty($bots)) : ?>
                <p style="color:#888;">Intet filtreret endnu.</p>
            <?php else : ?>
                <p style="color:#555;"><strong><?php echo number_format_i18n($bot_total); ?></strong> hits filtreret fra i alt:</p>
                <table class="widefat striped" style="max-width:420px;">
                    <thead><tr><th>Type</th><th style="text-align:right;">Antal</th></tr></thead>
                    <tbody>
                    <?php foreach ($bots as $b) : ?>
                        <tr><td><?php echo esc_html($b['bot_tag'] !== '' ? $b['bot_tag'] : '(uspecificeret)'); ?></td>
                            <td style="text-align:right;"><?php echo number_format_i18n((int) $b['n']); ?></td></tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>

            <h2 style="margin-top:30px;">Seneste 20 hits</h2>
            <table class="widefat striped" style="max-width:760px;">
                <thead><tr><th>Tid</th><th>Mail</th><th>Placering</th><th>Enhed</th><th>Status</th></tr></thead>
                <tbody>
                <?php if (empty($recent)) : ?>
                    <tr><td colspan="5">Ingen hits endnu.</td></tr>
                <?php else : foreach ($recent as $r) : ?>
                    <tr>
                        <td><?php echo esc_html($r['ts']); ?></td>
                        <td><?php echo esc_html($r['mail_type'] !== '' ? $r['mail_type'] : '-'); ?></td>
                        <td><?php echo esc_html($r['link_id'] !== '' ? $r['link_id'] : '-'); ?></td>
                        <td><?php echo esc_html($r['device']); ?></td>
                        <td><?php echo $r['bot'] ? '<span style="color:#b32d2e;">filtreret: ' . esc_html($r['bot_tag']) . '</span>' : '<span style="color:#207b3f;">talt</span>'; ?></td>
                    </tr>
                <?php endforeach; endif; ?>
                </tbody>
            </table>
        </div>
        <?php
    }
}

/* ---------------------------------------------------------------- hooks */

add_action('plugins_loaded', ['HG_Click_Tracker', 'maybe_install']);
add_action('admin_menu', ['HG_Click_Tracker', 'admin_menu'], 11);
add_action('hg_clk_cleanup', ['HG_Click_Tracker', 'cleanup']);

// Fallback-endpoint: virker selv hvis /k/-mappen forsvinder ved et FTP-uheld.
add_action('init', function () {
    if (!empty($_GET['hgk'])) {
        HG_Click_Tracker::handle();
    }
});

add_action('init', function () {
    if (!wp_next_scheduled('hg_clk_cleanup')) {
        wp_schedule_event(time() + 3600, 'daily', 'hg_clk_cleanup');
    }
});

add_filter('robots_txt', function ($output) {
    return $output . "Disallow: /k/\n";
}, 10, 1);
