<?php
/**
 * Email Templates Class for Hittegodscentralen Users
 * Manages customizable email templates
 *
 * NEWDESIGN-variant (2026-06-01): re-skinnet med nyt layout (Abhaya, kort + GREYDOT-footer).
 * Bygget oven på den LIVE version (28. maj). Logik/typer/variabler/render/admin er UÆNDRET.
 * Kun get_email_wrapper(), get_extra_sections() og bodies (get_default_templates) er nye.
 */


if (!defined('ABSPATH')) exit;

class HG_Email_Templates {

    const OPTION_KEY = 'hg_email_templates';

    /**
     * Per-type afsender. Typer der IKKE står her bruger den fælles hg_from_email-indstilling.
     */
    private static $from_overrides = [
        'business_welcome' => 'hittegodscentralen@greydot.dk',
        'support_reply'    => 'support@greydot.dk',
    ];

    /**
     * Available template types
     */
    private static $template_types = [
        'welcome' => [
            'name' => 'Velkomst email',
            'description' => 'Sendes til nye brugere ved registrering',
            'variables' => ['user_name', 'site_name', 'login_url', 'dashboard_url'],
        ],
        'password_reset' => [
            'name' => 'Nulstil adgangskode',
            'description' => 'Sendes når brugere anmoder om at nulstille password',
            'variables' => ['user_name', 'site_name', 'reset_url'],
        ],
        'new_message' => [
            'name' => 'Ny besked notifikation',
            'description' => 'Sendes når en bruger modtager en ny besked',
            'variables' => ['user_name', 'sender_name', 'message_preview', 'post_title', 'inbox_url', 'site_name'],
        ],
        'support_reply' => [
            'name' => 'Support svar',
            'description' => 'Sendes når support svarer på en henvendelse',
            'variables' => ['user_name', 'reply_message', 'original_message', 'site_name'],
        ],
        'support_notify' => [
            'name' => 'Support notifikation (intern)',
            'description' => 'Sendes til support-teamet når en bruger opretter en henvendelse',
            'variables' => ['from_name', 'from_email', 'subject', 'message', 'admin_url', 'site_name'],
        ],
        'post_expiring' => [
            'name' => 'Opslag udlober snart',
            'description' => 'Sendes X dage for et opslag automatisk lukkes',
            'variables' => ['user_name', 'post_title', 'post_url', 'days_left', 'site_name'],
        ],
        'post_expired' => [
            'name' => 'Opslag udlobet',
            'description' => 'Sendes når et opslag automatisk er blevet lukket',
            'variables' => ['user_name', 'post_title', 'dashboard_url', 'support_url', 'site_name'],
        ],
        'search_agent_confirm' => [
            'name' => 'Søgeagent bekræftelse',
            'description' => 'Sendes når en bruger opretter en søgeagent',
            'variables' => ['search_term', 'unsubscribe_url', 'site_url', 'site_name'],
        ],
        'search_agent_match' => [
            'name' => 'Søgeagent match notifikation',
            'description' => 'Sendes når nye opslag matcher en søgeagent',
            'variables' => ['search_term', 'match_count', 'matches_html', 'search_url', 'unsubscribe_url', 'site_url', 'site_name'],
        ],
        'post_created' => [
            'name' => 'Opslag oprettet bekræftelse',
            'description' => 'Sendes når en bruger opretter et nyt tabt eller fundet opslag',
            'variables' => ['first_name', 'post_title', 'post_type_label', 'post_url', 'soegeagent_url', 'del_url', 'claim_section', 'site_name'],
        ],
        'pickup_info' => [
            'name' => 'Afhentningsinformation',
            'description' => 'Sendes til den der gør krav på en genstand med afhentningssted og tidspunkt',
            'variables' => ['claimer_name', 'item_title', 'org_name', 'pickup_address', 'pickup_hours', 'return_instructions', 'item_url', 'site_name'],
        ],
        'feedback_received' => [
            'name' => 'Feedback modtaget',
            'description' => 'Sendes når brugere udfylder feedback-formularen',
            'variables' => ['user_name', 'feedback_type', 'site_name'],
        ],
        'support_received' => [
            'name' => 'Support modtaget',
            'description' => 'Sendes når brugere opretter en support-henvendelse',
            'variables' => ['user_name', 'subject', 'message_preview', 'site_name'],
        ],
        'business_welcome' => [
            'name' => 'Business velkomst',
            'description' => 'Sendes når en virksomhed opretter et business-abonnement',
            'variables' => ['org_name', 'username', 'email', 'admin_url', 'public_search_url', 'site_name'],
        ],
        'claim_contact' => [
            'name' => 'Kontakthenvendelse (genstand)',
            'description' => 'Sendes til ejeren når en person kontakter dem via genstandssiden',
            'variables' => ['owner_name', 'post_title', 'post_type_label', 'post_url', 'contact_name', 'contact_email', 'contact_phone', 'contact_message', 'site_name'],
        ],
        'business_claim' => [
            'name' => 'Ny henvendelse (virksomhed)',
            'description' => 'Sendes til virksomheden når en person gør krav på en genstand',
            'variables' => ['org_name', 'item_name', 'claimer_name', 'claimer_email', 'claimer_phone', 'claimer_message', 'item_url', 'site_name'],
        ],
        'business_pickup' => [
            'name' => 'Afhentningsbekræftelse (virksomhed)',
            'description' => 'Sendes til virksomheden når en bruger bekræfter afhentning',
            'variables' => ['org_name', 'item_name', 'pickup_location', 'admin_url', 'site_name'],
        ],
        'unread_message_reminder' => [
            'name' => 'Ulæst besked påmindelse',
            'description' => 'Sendes når en besked har været ulæst i 24+ timer',
            'variables' => ['user_name', 'sender_name', 'post_title', 'inbox_url', 'site_name'],
        ],
        'post_created_share' => [
            'name' => 'Del dit opslag (drip)',
            'description' => 'Sendes 24 timer efter opslag er oprettet for at opfordre til deling',
            'variables' => ['first_name', 'post_title', 'post_url', 'post_type_label', 'site_name'],
        ],
        'anniversary' => [
            'name' => 'Jubilæums-email',
            'description' => 'Sendes på årsdagen for brugerens registrering',
            'variables' => ['user_name', 'years', 'site_name'],
        ],
    ];

    /**
     * Get default templates (NYT DESIGN — bodies som table-rækker, inline styling)
     */
    public static function get_default_templates() {
        $ff  = "font-family:'Abhaya Libre',Georgia,'Times New Roman',serif;";
        $h1  = 'margin:0; ' . $ff . ' font-size:28px; line-height:1.3; color:#222222; font-weight:700;';
        $sub = 'margin:8px 0 0 0; ' . $ff . ' font-size:17px; color:#D2802E; font-weight:600;';
        $txt = $ff . ' font-size:17px; line-height:1.6; color:#444444;';
        $cta = 'display:inline-block; padding:14px 36px; ' . $ff . ' font-size:18px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:6px;';

        // Row-builders (returnerer hver én <tr>)
        $headline = function ($title, $slogan = 'Hurtig hjælp er dobbelt hjælp') use ($h1, $sub) {
            $s = $slogan !== '' ? '<p style="' . $sub . '">' . $slogan . '</p>' : '';
            return '<tr><td align="center" style="padding:32px 32px 8px 32px;"><h1 style="' . $h1 . '">' . $title . '</h1>' . $s . '</td></tr>';
        };
        $para = function ($html, $pad = '20px 40px 0 40px') use ($txt) {
            return '<tr><td align="center" style="padding:' . $pad . ';"><p style="margin:0; ' . $txt . '">' . $html . '</p></td></tr>';
        };
        $button = function ($url, $label) use ($cta) {
            return '<tr><td align="center" style="padding:28px 32px 8px 32px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td bgcolor="#D2802E" style="border-radius:6px;"><a href="' . $url . '" target="_blank" style="' . $cta . '">' . $label . '</a></td></tr></table></td></tr>';
        };
        $quote = function ($html) use ($ff) {
            return '<tr><td align="center" style="padding:18px 40px 0 40px;"><p style="margin:0; ' . $ff . ' font-size:16px; line-height:1.6; color:#444444; font-style:italic; padding:14px 0; border-top:1px solid #e6e6e6; border-bottom:1px solid #e6e6e6;">' . $html . '</p></td></tr>';
        };
        $muted = function ($html) use ($ff) {
            return '<tr><td align="center" style="padding:14px 40px 0 40px;"><p style="margin:0; ' . $ff . ' font-size:13px; line-height:1.5; color:#999999;">' . $html . '</p></td></tr>';
        };
        $label = function ($lbl, $val) use ($ff) {
            return '<tr><td align="center" style="padding:18px 40px 0 40px;"><p style="margin:0 0 4px 0; ' . $ff . ' font-size:11px; font-weight:700; color:#888888; letter-spacing:1.5px; text-transform:uppercase;">' . $lbl . '</p><p style="margin:0; ' . $ff . ' font-size:16px; color:#222222;">' . $val . '</p></td></tr>';
        };
        $rawrow = function ($html, $pad = '18px 40px 0 40px') {
            return '<tr><td style="padding:' . $pad . ';">' . $html . '</td></tr>';
        };

        // --- Tætte varianter (ROLANDS-design) — KUN til bruger-mails. De delte builders ovenfor (business/øvrige) er UÆNDRET. ---
        // Brødtekst/overskrifter/knapper er skaleret 4px ned (finskrift/muted uændret).
        $h1_9 = 'margin:0; ' . $ff . ' font-size:24px; line-height:1.3; color:#222222; font-weight:700;';
        $txt9 = $ff . ' font-size:13px; line-height:1.5; color:#444444;';
        $sub9 = 'margin:4px 0 0 0; ' . $ff . ' font-size:13px; color:#D2802E; font-weight:600;';
        $cta9 = 'display:inline-block; padding:10px 26px; ' . $ff . ' font-size:14px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:6px;';
        $headline9 = function ($title, $slogan = 'Hurtig hjælp er dobbelt hjælp') use ($h1_9, $sub9) {
            $s = $slogan !== '' ? '<p style="' . $sub9 . '">' . $slogan . '</p>' : '';
            return '<tr><td align="center" style="padding:26px 32px 4px 32px;"><h1 style="' . $h1_9 . '">' . $title . '</h1>' . $s . '</td></tr>';
        };
        $para9 = function ($html, $pad = '12px 40px 0 40px') use ($txt9) {
            return '<tr><td align="center" style="padding:' . $pad . ';"><p style="margin:0; ' . $txt9 . '">' . $html . '</p></td></tr>';
        };
        $button9 = function ($url, $label) use ($cta9) {
            return '<tr><td align="center" style="padding:16px 32px 8px 32px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td bgcolor="#D2802E" style="border-radius:6px;"><a href="' . $url . '" target="_blank" style="' . $cta9 . '">' . $label . '</a></td></tr></table></td></tr>';
        };
        $muted9 = function ($html) use ($ff) {
            return '<tr><td align="center" style="padding:12px 40px 0 40px;"><p style="margin:0; ' . $ff . ' font-size:13px; line-height:1.5; color:#999999;">' . $html . '</p></td></tr>';
        };
        $rawrow9 = function ($html, $pad = '12px 40px 0 40px') {
            return '<tr><td style="padding:' . $pad . ';">' . $html . '</td></tr>';
        };

        return [
            'welcome' => [
                'subject' => 'Velkommen til {site_name}!',
                'body' =>
                    $headline9('Velkommen, {user_name}!') .
                    $para9('Du har lavet en konto på <strong>{site_name}</strong>.') .
                    $para9('Du kan nu holde overblik over dine tabte og fundne genstande, modtage beskeder via siden og få adgang til hurtig support!', '10px 40px 0 40px') .
                    $button9(self::k('welcome', 'dashboard'), 'Gå til konto'),
                'has_extra_sections' => true,
            ],
            'password_reset' => [
                'subject' => 'Nulstil din adgangskode - {site_name}',
                'body' =>
                    $headline9('Hej {user_name}!', 'Det ser ud til du har mistet din adgangskode') .
                    $para9('Heldigvis er en kode nem at erstatte! Tryk på knappen herunder for at vælge en ny.') .
                    $button9('{reset_url}', 'Nulstil adgangskode') .
                    $muted9('Har du ikke selv bedt om at nulstille din adgangskode? Så kan du roligt se bort fra denne mail. Din nuværende kode virker stadig.'),
                'has_extra_sections' => true,
            ],
            'new_message' => [
                'subject' => 'Ny besked fra {sender_name} - {site_name}',
                'body' =>
                    $headline9('Hej {user_name}!') .
                    $para9('Du har modtaget en ny besked i din indbakke.') .
                    $button9(self::k('new_message', 'inbox'), 'Gå til indbakke'),
            ],
            'support_reply' => [
                'subject' => 'Svar på din henvendelse - {site_name}',
                'body' =>
                    $headline9('Svar på din henvendelse', 'Hej {user_name}!') .
                    $para9('Vi har svaret på din henvendelse:') .
                    $rawrow9('<div style="background:#f8fafc; border-left:3px solid #D2802E; border-radius:6px; padding:12px 16px;"><p style="margin:0; ' . $txt9 . '">{reply_message}</p></div>') .
                    $muted9('<strong style="color:#888888;">Din oprindelige besked:</strong><br>{original_message}'),
                'has_extra_sections' => true,
            ],
            'support_notify' => [
                'subject' => '[{site_name} Support] {subject}',
                'body' =>
                    $headline9('Ny supportbesked', 'Fra {from_name}') .
                    $label('Email', '{from_email}') .
                    $label('Emne', '{subject}') .
                    $rawrow9('<div style="background:#f8fafc; border-left:3px solid #D2802E; border-radius:6px; padding:12px 16px;"><p style="margin:0; ' . $txt9 . '">{message}</p></div>') .
                    $button9('{admin_url}', 'Åbn i support-panel'),
                'has_extra_sections' => true,
            ],
            'post_expiring' => [
                'subject' => 'Dit opslag udlober snart - {site_name}',
                'body' =>
                    $headline9('Dit opslag {post_title} er ved at udløbe') .
                    $para9('Har du stadig ikke fået genforenet?') .
                    $para9('Del dit opslag på sociale medier for ekstra synlighed. Jo flere der ser det, jo større er chancen for at finde hinanden.', '10px 40px 0 40px') .
                    $button9('https://www.facebook.com/sharer/sharer.php?u={post_url}', 'Del på sociale medier') .
                    $para9('Vi vil også meget gerne høre om din oplevelse med Hittegodscentralen. <a href="' . self::k('post_expiring', 'feedback') . '" target="_blank" style="color:#D2802E; font-weight:700; text-decoration:underline;">Giv os feedback</a>.', '12px 40px 0 40px'),
            ],
            'post_expired' => [
                'subject' => 'Dit opslag er lukket - {site_name}',
                'body' =>
                    $headline9('Dit opslag {post_title} er udløbet!') .
                    $para9('Vi håber du fik genforenet.') .
                    $para9('Vi vil meget gerne høre om din oplevelse med Hittegodscentralen.', '10px 40px 0 40px') .
                    $button9(self::k('post_expired', 'feedback'), 'Feedback'),
                'has_extra_sections' => true,
            ],
            'search_agent_confirm' => [
                'subject' => 'Søgeagent oprettet: "{search_term}"',
                'body' =>
                    $headline9('Din søgeagent er oprettet!') .
                    $para9('Du har oprettet en søgeagent på <strong style="color:#222222;">{search_term}</strong>.') .
                    $para9('Vi holder øje for dig, du får en mail, så snart der bliver oprettet et opslag, der matcher din søgning.', '10px 40px 0 40px') .
                    $muted9('Ønsker du ikke længere at modtage notifikationer? <a href="{unsubscribe_url}" target="_blank" style="color:#D2802E; text-decoration:underline;">Afmeld søgeagent</a>'),
                'has_extra_sections' => true,
            ],
            'search_agent_match' => [
                'subject' => '{match_count} nye match for "{search_term}"',
                'body' =>
                    $headline9('Du har et match!') .
                    $para9('Din søgning på <strong style="color:#222222;">{search_term}</strong> har givet resultat. Der er netop oprettet nye opslag, der matcher.') .
                    $rawrow9('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">{matches_html}</table>') .
                    $button9('{search_url}', 'Se alle resultater') .
                    $muted9('<a href="{unsubscribe_url}" target="_blank" style="color:#999999; text-decoration:underline;">Afmeld denne søgeagent</a>'),
            ],
         
         'post_created' => [
        'subject' => 'Hittegodscentralen | {post_title}',
        'body' =>

            '<tr>
            <td class="px" style="padding:24px 32px 10px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td valign="top" style="padding-right:12px;">
                            <img src="https://hittegodscentralen.dk/wp-content/uploads/2026/04/cropped-greydot-logo-hittegods.png"
                                 width="42" height="42" alt="Hittegodscentralen"
                                 style="display:block; width:42px; height:42px; border:0; outline:none; text-decoration:none;">
                        </td>
                        <td valign="middle">
                            <div style="' . $ff . ' font-size:18px; line-height:1.2; font-weight:700; color:#111111;">Hittegodscentralen</div>
                            <div style="' . $ff . ' font-size:10px; line-height:1.2; letter-spacing:1.5px; text-transform:uppercase; color:#D2802E; font-weight:700; padding-top:3px;">D&aelig;kker alt &ndash; over alt</div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>


        <tr>
            <td class="px" style="padding:16px 32px 0 32px;">
                <h1 style="margin:0; ' . $ff . ' font-size:16px; line-height:1.5; color:#2A2A2A;">
                    <strong>{post_title}</strong> er nu synligt p&aring; Hittegodscentralen.
                </h1>
            </td>
        </tr>


        <tr>
            <td class="px" style="padding:28px 32px 0 32px;">
                <div style="height:1px; background:#E5E1D7; line-height:1px; font-size:1px;">&nbsp;</div>
            </td>
        </tr>

        ' . self::get_promo_block('post_created') . '

        <tr>
            <td class="px" style="padding:28px 32px 26px 32px;">
                <p style="margin:0 0 6px 0; ' . $ff . ' font-size:12px; line-height:1.6; color:#7A7A7A;">
                    Hittegodscentralen &middot; by GREYDOT &middot; CVR 34399131
                </p>

                <p style="margin:0 0 12px 0; ' . $ff . ' font-size:12px; line-height:1.6; color:#7A7A7A;">
                    J. Skjoldborgs Vej 57, 8230 &Aring;byh&oslash;j &middot; Tlf. +45 22 58 41 42
                </p>

                <p style="margin:0; ' . $ff . ' font-size:12px; line-height:1.6;">
                    <a href="' . self::k('post_created', 'privacy') . '" style="color:#7A7A7A; text-decoration:none;">Privatlivspolitik</a>

                    &nbsp;&nbsp;&nbsp;
                    <a href="' . self::k('post_created', 'support') . '" style="color:#7A7A7A; text-decoration:none;">Support</a>
                </p>
            </td>
        </tr>',

        'has_extra_sections' => false,
    ],
 'pickup_info' => [
                'subject' => 'Afhentningsinformation: "{item_title}" fra {org_name}',
                'body' =>
                    $headline('Hej {claimer_name}!') .
                    $para('Tak fordi du kontaktede <strong style="color:#222222;">{org_name}</strong> vedrørende genstanden "<strong>{item_title}</strong>".') .
                    $para('Herunder finder du information om, hvordan du kan afhente din genstand.', '14px 40px 0 40px') .
                    $rawrow('{pickup_section}{return_section}') .
                    $button('{item_url}', 'Se genstanden'),
                'has_extra_sections' => true,
            ],
            'feedback_received' => [
                'subject' => 'Tak for din feedback - {site_name}',
                'body' =>
                    $headline9('Tak for din feedback!') .
                    $para9('Vi gennemser den hurtigst muligt. Din henvendelse hjælper os med at gøre {site_name} endnu bedre.'),
                'has_extra_sections' => true,
            ],
            'support_received' => [
                'subject' => 'Tak for din henvendelse - {site_name}',
                'body' =>
                    $headline9('Tak for din henvendelse, {user_name}!') .
                    $para9('Vi har modtaget din support-besked og vender tilbage hurtigst muligt.') .
                    $label('Emne', '{subject}') .
                    $rawrow9('<div style="background:#f8fafc; border-left:3px solid #D2802E; border-radius:6px; padding:12px 16px;"><p style="margin:0; ' . $txt9 . '">{message_preview}</p></div>') .
                    $muted9('Du kan se status på din henvendelse under din profil.'),
                'has_extra_sections' => true,
            ],
            'business_welcome' => [
                'subject' => 'Velkommen til {site_name} for virksomheder!',
                'body' =>
                    $headline('Velkommen, {org_name}!') .
                    $para('Velkommen til Hittegodscentralen for virksomheder. Jeres konto er nu oprettet, og I kan logge ind på administrationspanelet med det samme.') .
                    '<tr><td align="center" style="padding:18px 40px 0 40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e6e6e6; border-radius:8px;">' .
                        '<tr><td style="padding:11px 16px; ' . $ff . ' font-size:15px; color:#888888; width:40%; text-align:left;">Login</td><td style="padding:11px 16px; ' . $ff . ' font-size:15px; text-align:left;"><a href="{admin_url}" target="_blank" style="color:#2C658F; text-decoration:underline; font-weight:700;">{admin_url}</a></td></tr>' .
                        '<tr><td style="border-top:1px solid #e6e6e6; padding:11px 16px; ' . $ff . ' font-size:15px; color:#888888; text-align:left;">Brugernavn</td><td style="border-top:1px solid #e6e6e6; padding:11px 16px; ' . $ff . ' font-size:15px; font-weight:700; color:#222222; text-align:left;">{username}</td></tr>' .
                        '<tr><td style="border-top:1px solid #e6e6e6; padding:11px 16px; ' . $ff . ' font-size:15px; color:#888888; text-align:left;">Email</td><td style="border-top:1px solid #e6e6e6; padding:11px 16px; ' . $ff . ' font-size:15px; font-weight:700; color:#222222; text-align:left;">{email}</td></tr>' .
                    '</table></td></tr>' .
                    $para('I har jeres egen offentlige søgeside, hvor jeres brugere kan søge efter glemte ting, henvende sig og oprette tabt-og-fundet-genstande. Del linket på jeres hjemmeside og sociale medier.', '18px 40px 0 40px') .
                    $button('{public_search_url}', 'Se jeres søgeside') .
                    $para('Har I spørgsmål, kan I svare direkte på denne mail.', '18px 40px 0 40px'),
                'has_extra_sections' => false,
            ],
            'claim_contact' => [
                'subject' => 'Henvendelse vedr. din {post_type_label} genstand: {post_title}',
                'body' =>
                    $headline9('Hej {owner_name}!') .
                    $para9('En person har kontaktet dig vedrørende din {post_type_label} genstand <strong style="color:#222222;">{post_title}</strong>.') .
                    $label('Navn', '{contact_name}') .
                    $label('Email', '{contact_email}') .
                    $label('Telefon', '{contact_phone}') .
                    $rawrow9('<div style="background:#f8fafc; border-left:3px solid #D2802E; border-radius:6px; padding:12px 16px;"><p style="margin:0; ' . $txt9 . '">{contact_message}</p></div>') .
                    $button9('{post_url}', 'Se opslaget'),
                'has_extra_sections' => true,
            ],
            'business_claim' => [
                'subject' => 'Ny henvendelse: {item_name}',
                'body' =>
                    $headline('Hej, {org_name}!') .
                    $para('En person har gjort krav på genstanden <strong style="color:#222222;">{item_name}</strong>.') .
                    $label('Navn', '{claimer_name}') .
                    $label('Email', '{claimer_email}') .
                    $label('Telefon', '{claimer_phone}') .
                    $quote('{claimer_message}') .
                    $button('{item_url}', 'Gå til genstand'),
                'has_extra_sections' => false,
            ],
            'business_pickup' => [
                'subject' => 'Afhentning bekræftet: {item_name} - {site_name}',
                'body' =>
                    $headline('Hej, {org_name}!') .
                    $para('En bruger har bekræftet afhentning af <strong style="color:#222222;">{item_name}</strong> ved {pickup_location}.') .
                    $para('Genstanden er nu markeret som returneret og slettes automatisk om 7 dage.', '14px 40px 0 40px') .
                    $button('{admin_url}', 'Se i panelet'),
                'has_extra_sections' => false,
            ],
            'unread_message_reminder' => [
                'subject' => 'Du har en ulæst besked - {site_name}',
                'body' =>
                    $headline('Du har en ulæst besked') .
                    $para('Hej {user_name}! <strong style="color:#222222;">{sender_name}</strong> sendte dig en besked vedrørende "<strong>{post_title}</strong>", og den er stadig ulæst.') .
                    $button(self::k('unread_message_reminder', 'inbox'), 'Læs besked'),
                'has_extra_sections' => false,
            ],
            'post_created_share' => [
                'subject' => 'Del dit opslag for mere synlighed - {site_name}',
                'body' =>
                    $headline('Hej {first_name}!') .
                    $para('Dit opslag for din {post_type_label} genstand <strong style="color:#222222;">"{post_title}"</strong> har nu været live i 24 timer.') .
                    $para('Del på sociale medier for ekstra synlighed. Jo flere der ser det, jo større chance for at finde hinanden.', '14px 40px 0 40px') .
                    $button('{post_url}', 'Se dit opslag'),
                'has_extra_sections' => true,
            ],
            'anniversary' => [
                'subject' => 'Tillykke med {years} år på {site_name}!',
                'body' =>
                    $headline('Tillykke med {years} år, {user_name}!') .
                    $para('I dag er det {years} år siden du blev en del af {site_name}.') .
                    $para('Tak fordi du er med til at gøre en forskel. Sammen hjælper vi tabte ting hjem.', '14px 40px 0 40px'),
                'has_extra_sections' => true,
            ],
        ];
    }

    /**
     * Get all template types
     */
    public static function get_template_types() {
        return self::$template_types;
    }

    /**
     * Get all templates (custom or default)
     */
    public static function get_templates() {
        // Standarderne (i koden) vinder ALTID. Gemte DB-overrides ignoreres bevidst —
        // admin-redigering bruges ikke (siden er read-only). Det fjerner wp_options-fælden.
        return self::get_default_templates();
    }

    /**
     * Get a specific template
     */
    public static function get_template($type) {
        $templates = self::get_templates();
        return $templates[$type] ?? self::get_default_templates()[$type] ?? null;
    }

    /**
     * Save template
     */
    public static function save_template($type, $subject, $body) {
        $templates = get_option(self::OPTION_KEY, []);

        $templates[$type] = [
            'subject' => sanitize_text_field($subject),
            'body' => wp_kses_post($body),
        ];

        update_option(self::OPTION_KEY, $templates);
    }

    /**
     * Reset template to default
     */
    public static function reset_template($type) {
        $templates = get_option(self::OPTION_KEY, []);

        if (isset($templates[$type])) {
            unset($templates[$type]);
            update_option(self::OPTION_KEY, $templates);
        }
    }

    /**
     * Render email with variables
     */
    public static function render($type, $variables = []) {
        $template = self::get_template($type);

        if (!$template) {
            return null;
        }

        // Default variables
        $variables = array_merge([
            'site_name' => get_option('hg_from_name', 'Hittegodscentralen'),
            'site_url' => home_url(),
            'login_url' => home_url('/login'),
            'dashboard_url' => home_url('/profil'),
            'inbox_url' => home_url('/beskeder'),
        ], $variables);

        $subject = $template['subject'];
        $body = $template['body'];

        // Build pickup_info dynamic sections
        if ($type === 'pickup_info') {
            $pickup_section = '';
            $return_section = '';
            $contact_section = '';

            if (!empty($variables['pickup_address'])) {
                $pickup_section = '
                    <div style="background:#f0faf9;border:1px solid #d1e5e3;border-radius:8px;padding:16px 20px;margin:16px 0;">
                        <h3 style="margin:0 0 8px 0;font-size:15px;color:#1e293b;">Afhentningssted</h3>
                        <p style="margin:0 0 4px 0;font-size:14px;color:#475569;">' . esc_html($variables['pickup_address']) . '</p>'
                        . (!empty($variables['pickup_hours']) ? '<p style="margin:0;font-size:13px;color:#64748b;"><strong>Åbningstider:</strong> ' . esc_html($variables['pickup_hours']) . '</p>' : '') .
                    '</div>';
            }

            if (!empty($variables['return_instructions'])) {
                $return_section = '
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:16px 0;">
                        <h3 style="margin:0 0 8px 0;font-size:15px;color:#1e293b;">Sådan får du din genstand retur</h3>
                        <p style="margin:0;font-size:14px;color:#475569;">' . nl2br(esc_html($variables['return_instructions'])) . '</p>
                    </div>';
            }

            // Kontakt-boks (virksomhedens org_email/org_phone) FJERNET 2026-07-29:
            // oplysningerne var forkerte (auto-genereret systemadresse + forkert telefonnummer).
            // $contact_section holdes tom som guard, så en evt. rest-pladsholder aldrig lækker.

            $variables['pickup_section'] = $pickup_section;
            $variables['return_section'] = $return_section;
            $variables['contact_section'] = $contact_section;
        }

        // Pak dynamiske per-bruger/opslag-links ind i klik-tracking. Modsat de faste
        // knapper (self::k()) kan destinationen her ikke whitelistes paa forhaand,
        // saa vaerten valideres i stedet i hg-click-tracker.php (validate_dynamic_url).
        foreach (self::dynamic_trackable_vars($type) as $var => $link_id) {
            if (!empty($variables[$var])) {
                $variables[$var] = self::ku($type, $link_id, $variables[$var]);
            }
        }

        // Replace variables
        foreach ($variables as $key => $value) {
            $subject = str_replace('{' . $key . '}', $value, $subject);
            $body = str_replace('{' . $key . '}', $value, $body);
        }

        // Append Ejendelsregisteret-promo (lille grøn / stor billed-boks / ingen — pr. type)
        $body .= self::get_extra_sections($type);

        $html = self::get_email_wrapper($body, $type);

        return [
            'subject' => $subject,
            'body' => $html,
        ];
    }

    /**
     * Send email using template
     */
    public static function send($type, $to, $variables = []) {
        $email = self::render($type, $variables);

        if (!$email) {
            return false;
        }

        // Per-type afsender hvis defineret, ellers den fælles indstilling.
        $from_email = self::$from_overrides[$type] ?? get_option('hg_from_email', 'noreply@greydot.dk');
        $headers = [
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . get_option('hg_from_name', 'Hittegodscentralen') . ' <' . $from_email . '>',
          
        ];

        return wp_mail($to, $email['subject'], $email['body'], $headers);
    }

    /**
     * Get email wrapper HTML (NYT DESIGN: header + content + signatur + fast footer)
     * $content er table-rækker (<tr>...).
     */
    private static function get_email_wrapper($content, $type = '') {
        $site_name = get_option('hg_from_name', 'Hittegodscentralen');
        $site_url  = home_url();
        $logo_url  = 'https://hittegodscentralen.dk/wp-content/uploads/2026/04/cropped-greydot-logo-hittegods.png';
        $ff        = "font-family:'Abhaya Libre',Georgia,'Times New Roman',serif;";

        return '<!DOCTYPE html>
<html lang="da">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="format-detection" content="telephone=no">
    <title>' . esc_html($site_name) . '</title>
    <!--[if !mso]><!-->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Abhaya+Libre:wght@400;600;700;800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
    <!--<![endif]-->
    <!--[if mso]><style>* { font-family: Georgia, serif !important; }</style><![endif]-->
    <style>
       @media only screen and (max-width:600px) {
  /* Fjerner den ydre grå kant, så kortet går helt ud til skærmkanten.
     Kræver class="outer-pad" på wrapperens yderste <td> — se noten øverst. */
  .outer-pad { padding-left:0 !important; padding-right:0 !important; }
  .wrap      { width:100% !important; max-width:100% !important; border-radius:0 !important; }

  .px       { padding-left:20px !important; padding-right:20px !important; }
  .card-pad { padding:22px 20px !important; }

  /* Knapper stakker i fuld bredde */
  .btn-row, .btn-row tbody, .btn-row tr, .btn-row td {
    display:block !important; width:100% !important;
  }
  .btn-gap   { height:10px !important; font-size:10px !important; line-height:10px !important; }
  .btn-row a { display:block !important; text-align:center !important; }
}
    </style>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; ' . $ff . ' -webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;">
<tr>
<td align="center" class="body-outer" style="padding:24px 12px;">
<table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; background-color:#ffffff; border-radius:8px; overflow:hidden;">

  

    ' . $content . '


</table>
</td>
</tr>
</table>
</body>
</html>';
    }
    /**
     * Mail-typer der baerer Ejendelsregisteret-reklamen (stribe + stor blok).
     * support_notify er en intern medarbejder-mail og staar bevidst udenfor.
     */
    private static function ad_types() {
        return ['welcome', 'password_reset', 'new_message', 'post_expiring', 'post_expired', 'search_agent_confirm', 'search_agent_match', 'feedback_received', 'support_reply', 'claim_contact', 'support_received'];
    }

    /**
     * Byg klik-tracking-link. Selve taelleren og whitelisten af destinationer
     * ligger i mu-plugins/hg-click-tracker.php - her bygges kun URL'en.
     */
    private static function k($type, $link_id) {
        return esc_url(home_url('/k/?m=' . rawurlencode($type) . '&l=' . $link_id));
    }

    /**
     * Samme redirect som k(), men til dynamiske per-bruger/opslag-URL'er (reset-
     * tokens, opslags-/genstandslinks, søgeresultater osv.) som ikke kan ligge i
     * en fast whitelist. Destinationen sendes med som parameteren "u" og host-valideres i
     * hg-click-tracker.php — så endpointet stadig ikke kan bruges som open redirect.
     */
    private static function ku($type, $link_id, $url) {
        if (empty($url)) return $url;
        return esc_url(home_url('/k/?m=' . rawurlencode($type) . '&l=' . rawurlencode($link_id) . '&u=' . rawurlencode($url)));
    }

    /**
     * Hvilke variabler pr. mail-type der skal tracking-pakkes ind via ku().
     * Kun variabler der bruges som rent href (aldrig vist som synlig tekst).
     */
    private static function dynamic_trackable_vars($type) {
        $map = [
            'password_reset'       => ['reset_url' => 'reset'],
            'search_agent_confirm' => ['unsubscribe_url' => 'unsubscribe'],
            'search_agent_match'   => ['search_url' => 'results', 'unsubscribe_url' => 'unsubscribe'],
            'pickup_info'          => ['item_url' => 'view_item'],
            'claim_contact'        => ['post_url' => 'view_post'],
            'business_claim'       => ['item_url' => 'view_item'],
            'post_created_share'   => ['post_url' => 'view_post'],
        ];
        return $map[$type] ?? [];
    }

    /**
     * Stor Ejendelsregisteret-annonceboks (navy box + "Opret dig"/"Påmind mig senere").
     * Tager $type ind så den kan genbruges på tværs af mail-typer — k() tæller
     * klikkene separat pr. type, så den er ikke længere hardkodet til post_created.
     */
    private static function get_promo_block($type) {
        $ff     = "font-family:'Abhaya Libre',Georgia,'Times New Roman',serif;";
        $signup = self::k($type, 'signup');
        $remind = self::k($type, 'remind');

        return '<tr>
            <td class="px" style="padding:28px 32px 0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1E3468; border-radius:12px;">
                    <tr>
                        <td class="card-pad" style="padding:12px 12px;">

                            <h2 style="margin:8px 0 12px 0; ' . $ff . ' font-size:26px; line-height:1.15; color:#FFFFFF; font-weight:700;">
                                Mist aldrig dine ting igen.
                            </h2>

                            <p style="margin:0 0 22px 0; ' . $ff . ' font-size:15px; line-height:1.65; color:#E6ECF7;">
                                Tag foto af dine ejendele og serienummeret, og registr&eacute;r dit ejerskab.
                                Bliver noget v&aelig;k eller stj&aring;let, kan en finder eller politiet finde dig.
                                <br><br>
                                S&aelig;lger du tingen, kan ejerskabet overdrages til k&oslash;beren direkte.
                            </p>

                            <table role="presentation" class="btn-row" width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>

                                    <td>
                                        <!--[if mso]>
                                        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                                                     href="' . $signup . '" arcsize="30%" stroke="f" fillcolor="#C8841E"
                                                     style="height:42px; v-text-anchor:middle; width:135px;">
                                            <w:anchorlock/>
                                            <center style="' . $ff . ' color:#FFFFFF; font-size:14px; font-weight:700;">Opret dig &rarr;</center>
                                        </v:roundrect>
                                        <![endif]-->
                                        <!--[if !mso]><!-->
                                        <a href="' . $signup . '" target="_blank"
                                           style="display:inline-block; background:#C8841E; border-radius:12px; padding:13px 26px; ' . $ff . ' font-size:14px; font-weight:700; color:#FFFFFF; text-decoration:none; line-height:1.2;">
                                            Opret dig &rarr;
                                        </a>
                                        <!--<![endif]-->
                                    </td>

                                    <td class="btn-gap" width="12">&nbsp;</td>

                                    <td>
                                        <!--[if mso]>
                                        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                                                     href="' . $remind . '" arcsize="30%" strokecolor="#4F6798" strokeweight="2px" fillcolor="#1E3468"
                                                     style="height:42px; v-text-anchor:middle; width:170px;">
                                            <w:anchorlock/>
                                            <center style="' . $ff . ' color:#E6ECF7; font-size:14px; font-weight:600;">P&aring;mind mig senere</center>
                                        </v:roundrect>
                                        <![endif]-->
                                        <!--[if !mso]><!-->
                                        <a href="' . $remind . '" target="_blank"
                                           style="display:inline-block; background:#1E3468; border:2px solid #4F6798; border-radius:12px; padding:11px 22px; ' . $ff . ' font-size:14px; font-weight:600; color:#E6ECF7; text-decoration:none; line-height:1.2;">
                                            P&aring;mind mig senere
                                        </a>
                                        <!--<![endif]-->
                                        <div style="' . $ff . ' font-size:15px; line-height:1.2; font-weight:700; Margin-top:18px; color:#FFFFFF;">Ejendelsregisteret</div>
                                        <div style="' . $ff . ' font-size:10px; line-height:1.2; letter-spacing:1.5px; text-transform:uppercase; color:#F0A13E; font-weight:700; padding-top:4px;">D&aelig;kker alt &ndash; over alt</div>
                                    </td>

                                </tr>
                            </table>

                        </td>
                    </tr>
                </table>
            </td>
        </tr>';
    }

    /**
     * Smal Ejendelsregisteret-stribe lige under sidehovedet. Vises paa praecis de
     * samme mails som den store blok i get_extra_sections() - de to hoerer sammen.
     */
    private static function get_ad_stripe($type) {
        if (!in_array($type, self::ad_types(), true)) {
            return '';
        }
        $ff = "font-family:'Abhaya Libre',Georgia,'Times New Roman',serif;";
        $k  = self::k($type, 'ad1');

        return '<tr>
        <td class="ad-row" style="padding:14px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate; border:2px solid #2C658F; border-radius:6px; overflow:hidden;">
                <tr>
                    <td bgcolor="#ffffff" style="background-color:#ffffff; vertical-align:middle; padding:10px 14px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="vertical-align:middle; padding-right:12px;">
                                    <a href="' . $k . '" target="_blank" style="color:#222222; text-decoration:none;"><img src="https://ejendelsregisteret.dk/wp-content/uploads/2026/03/cropped-greydot-logo-ejendel.png" width="36" height="36" alt="Ejendelsregisteret" style="display:block; border:0; width:36px; height:36px;"></a>
                                </td>
                                <td style="vertical-align:middle;">
                                    <a href="' . $k . '" target="_blank" style="color:#222222; text-decoration:none;">
                                        <p style="margin:0; ' . $ff . ' font-size:16px; line-height:1.1; color:#2C658F; font-weight:700;">Ejendelsregisteret.dk</p>
                                        <p style="margin:2px 0 0 0; ' . $ff . ' font-size:11px; letter-spacing:1px; color:#E48126; font-weight:700; text-transform:uppercase;">Du ejer dine ting &ndash; bevis det</p>
                                    </a>
                                </td>
                            </tr>
                        </table>
                    </td>
                    <td width="56" align="center" bgcolor="#2C658F" style="width:56px; background-color:#2C658F; vertical-align:middle;">
                        <a href="' . $k . '" target="_blank" style="display:block; padding:16px 0; text-decoration:none; font-family:Arial,Helvetica,sans-serif; font-size:22px; font-weight:bold; color:#ffffff; line-height:1;">&rarr;</a>
                    </td>
                </tr>
            </table>
        </td>
    </tr>';
    }

    /**
     * Get extra sections: Ejendelsregisteret-promo pr. type.
     * Navy-boksen (get_promo_block) tilføjes til alle mails i ad_types().
     * post_created har den allerede direkte i sin body, så den er bevidst
     * udenfor ad_types() for at undgå at boksen optræder to gange.
     */
  public static function get_extra_sections($type = '') {
    if (!in_array($type, self::ad_types(), true)) {
        return '';
    }
    return self::get_promo_block($type);
}

    /**
     * Register admin page
     */
    public static function add_admin_page() {
        add_submenu_page(
            'hg-dashboard',
            'Email Skabeloner',
            'Email Skabeloner',
            'manage_options',
            'hg-email-templates',
            [__CLASS__, 'render_admin_page']
        );
    }

    /**
     * Render admin page
     */
    public static function render_admin_page() {
        // READ-ONLY oversigt. Skabelonerne defineres i koden (get_default_templates) —
        // ingen redigering/gem her (bevidst; admin-editoren bruges ikke).
        $template_types = self::get_template_types();
        $templates = self::get_templates();
        ?>
        <div class="wrap hg-admin">
            <h1>Email Skabeloner</h1>
            <p>Oversigt over de emails systemet sender. Skabelonerne redigeres i koden
               (<code>class-hg-email-templates.php</code>) — denne side er kun til visning.</p>

            <?php foreach ($template_types as $type => $info):
                $tpl = $templates[$type] ?? null;
                if (!$tpl) continue; ?>
                <div class="hg-tpl-card">
                    <h2><?php echo esc_html($info['name']); ?>
                        <span class="hg-tpl-type"><?php echo esc_html($type); ?></span></h2>
                    <p class="hg-tpl-desc"><?php echo esc_html($info['description']); ?></p>
                    <p><strong>Emne:</strong> <?php echo esc_html($tpl['subject']); ?></p>
                    <p><strong>Variabler:</strong>
                        <?php foreach ($info['variables'] as $var): ?><code>{<?php echo esc_html($var); ?>}</code> <?php endforeach; ?>
                    </p>
                    <details>
                        <summary>Vis HTML-indhold</summary>
                        <pre class="hg-tpl-body"><?php echo esc_html($tpl['body']); ?></pre>
                    </details>
                </div>
            <?php endforeach; ?>
        </div>

        <style>
            .hg-tpl-card {
                background: #fff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 16px 20px;
                margin: 0 0 14px 0;
                max-width: 900px;
            }
            .hg-tpl-card h2 { margin: 0 0 4px 0; color: #1e3a5f; font-size: 17px; }
            .hg-tpl-type {
                font-size: 12px; font-weight: 400; color: #94a3b8;
                background: #f1f5f9; border-radius: 4px; padding: 2px 8px; margin-left: 6px;
            }
            .hg-tpl-desc { margin: 0 0 8px 0; color: #64748b; font-size: 13px; }
            .hg-tpl-card code { background: #f1f5f9; border-radius: 3px; padding: 1px 5px; font-size: 12px; }
            .hg-tpl-body {
                background: #0f172a; color: #e2e8f0; padding: 14px; border-radius: 6px;
                overflow: auto; max-height: 320px; font-size: 12px; line-height: 1.5; white-space: pre-wrap;
            }
        </style>
        <?php
    }
}
