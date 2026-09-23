import type { Locale } from "./i18n";

export type LegalDocKey = "legal" | "privacy" | "terms";

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDoc {
  title: string;
  updated: string;
  intro?: string;
  sections: LegalSection[];
}

export const legalDocs: Record<LegalDocKey, Record<Locale, LegalDoc>> = {
  legal: {
    zh: {
      title: "法律声明",
      updated: "2026-09-23",
      intro: "本页面说明 WS ATLAS 的编辑者、托管方以及网站内容的权属与致谢规则。",
      sections: [
        {
          heading: "编辑者",
          paragraphs: [
            "WS ATLAS 是由 Adrien 以个人身份创建并运营的非商业社区项目，通过域名 aremond.ovh 向公众提供。",
            "任何与网站相关的问题、请求或申诉，均可通过电子邮件 adrien.remond@protonmail.com 与我们联系。",
          ],
        },
        {
          heading: "发布负责人",
          paragraphs: ["发布负责人为网站运营者本人（Adrien），负责站内发布内容的编辑管理。"],
        },
        {
          heading: "托管",
          paragraphs: [
            "本网站由 OVHcloud SAS 托管，地址：2 rue Kellermann, 59100 Roubaix, France。",
          ],
        },
        {
          heading: "项目性质",
          paragraphs: [
            "WS ATLAS 是 War Selection 玩家社区制作的非官方粉丝项目。War Selection 是 Glyph Worlds 旗下的游戏；本站与 Glyph Worlds 不存在任何隶属、合作或支持关系，也不代表其官方立场。",
          ],
        },
        {
          heading: "知识产权",
          paragraphs: [
            "War Selection 的名称、标志、美术、数据与游戏内内容均为其所有者（Glyph Worlds）的财产。本站引用这些内容仅出于玩家社区的信息与交流目的，属非官方性质。",
            "社区内容（地图、Mod、说明与测试记录）归其作者所有；档案页面标注来源并署名作者。",
            "档案中的部分插图由 AI 生成（相关页面以 artwork-notes 标注），仅作版面配图使用。",
            "网站源代码公开于 GitHub（仓库 AustinLiu5567/ws-lab，experiments 分支），按仓库内标明的许可提供。",
          ],
        },
        {
          heading: "致谢",
          paragraphs: [
            "斯大林格勒档案与社区收藏中的地图由其作者提供，图片与说明在作者授权下使用；收藏条目逐条标注作者与来源。",
            "Mod 资料库引用的 GitHub 项目均为独立作品，遵循其各自的许可协议；本站仅作介绍与链接。",
          ],
        },
      ],
    },
    en: {
      title: "Legal notice",
      updated: "2026-09-23",
      intro:
        "This page identifies the publisher of WS ATLAS, its host, and the ownership and credit rules that apply to the site's content.",
      sections: [
        {
          heading: "Publisher",
          paragraphs: [
            "WS ATLAS is a non-commercial community project created and run on a personal basis by Adrien, and served to the public through the domain aremond.ovh.",
            "Any question, request or complaint about the website can be sent by email to adrien.remond@protonmail.com.",
          ],
        },
        {
          heading: "Publication director",
          paragraphs: [
            "The publication director is the site operator himself (Adrien), in charge of the editorial management of the content published on the site.",
          ],
        },
        {
          heading: "Hosting",
          paragraphs: [
            "This website is hosted by OVHcloud SAS, 2 rue Kellermann, 59100 Roubaix, France.",
          ],
        },
        {
          heading: "Project nature",
          paragraphs: [
            "WS ATLAS is an unofficial fan project made by the War Selection player community. War Selection is a game by Glyph Worlds; this site has no affiliation, partnership or endorsement from Glyph Worlds and does not represent its official position.",
          ],
        },
        {
          heading: "Intellectual property",
          paragraphs: [
            "The name, logos, artwork, data and in-game content of War Selection remain the property of their owner (Glyph Worlds). Their use on this site serves only community information and exchange purposes, on an unofficial basis.",
            "Community content (maps, mods, descriptions and test reports) belongs to its authors; archive pages mention the source and credit the authors.",
            "Some illustrations in the archive are AI-generated (flagged by the artwork-notes on the relevant pages) and are used for editorial purposes only.",
            "The website source code is public on GitHub (repository AustinLiu5567/ws-lab, experiments branch), provided under the license stated in the repository.",
          ],
        },
        {
          heading: "Credits",
          paragraphs: [
            "Maps in the Stalingrad archive and the community collection are provided by their authors, with images and descriptions used under their authorization; each collection entry credits its author and source.",
            "GitHub projects referenced in the mod library are independent works governed by their own licenses; the site only presents and links them.",
          ],
        },
      ],
    },
    fr: {
      title: "Mentions légales",
      updated: "2026-09-23",
      intro:
        "Cette page présente l'éditeur de WS ATLAS, son hébergeur, ainsi que les règles de propriété et de crédits applicables aux contenus du site.",
      sections: [
        {
          heading: "Éditeur",
          paragraphs: [
            "WS ATLAS est un projet communautaire non commercial créé et exploité à titre personnel par Adrien, et proposé au public via le domaine aremond.ovh.",
            "Toute question, demande ou réclamation relative au site peut être adressée par courriel à adrien.remond@protonmail.com.",
          ],
        },
        {
          heading: "Directeur de la publication",
          paragraphs: [
            "Le directeur de la publication est l'exploitant du site en personne (Adrien), responsable de la gestion éditoriale des contenus publiés.",
          ],
        },
        {
          heading: "Hébergement",
          paragraphs: [
            "Ce site est hébergé par OVHcloud SAS, 2 rue Kellermann, 59100 Roubaix, France.",
          ],
        },
        {
          heading: "Nature du projet",
          paragraphs: [
            "WS ATLAS est un projet de fans non officiel réalisé par la communauté de joueurs de War Selection. War Selection est un jeu édité par Glyph Worlds ; ce site n'entretient aucune affiliation, coopération ni aucun soutien avec Glyph Worlds et ne représente pas sa position officielle.",
          ],
        },
        {
          heading: "Propriété intellectuelle",
          paragraphs: [
            "Le nom, les logos, les visuels, les données et le contenu du jeu War Selection demeurent la propriété de leur titulaire (Glyph Worlds). Leur présence sur ce site répond uniquement à des finalités d'information et d'échange au sein de la communauté des joueurs, à titre non officiel.",
            "Les contenus communautaires (cartes, mods, descriptions et comptes rendus de tests) appartiennent à leurs auteurs ; les pages d'archive mentionnent la source et créditent les auteurs.",
            "Une partie des illustrations de l'archive est générée par IA (signalée par les mentions artwork-notes sur les pages concernées) ; elles servent uniquement d'habillage éditorial.",
            "Le code source du site est public sur GitHub (dépôt AustinLiu5567/ws-lab, branche experiments) et proposé selon la licence indiquée dans le dépôt.",
          ],
        },
        {
          heading: "Crédits",
          paragraphs: [
            "Les cartes de l'archive Stalingrad et de la collection communautaire sont fournies par leurs auteurs, avec leurs images et descriptions utilisées selon leur autorisation ; chaque entrée de la collection mentionne son auteur et sa source.",
            "Les projets GitHub référencés dans la bibliothèque de mods sont des œuvres indépendantes, régies par leurs propres licences ; le site se limite à les présenter et à y renvoyer.",
          ],
        },
      ],
    },
  },
  privacy: {
    zh: {
      title: "隐私政策",
      updated: "2026-09-23",
      intro: "本政策说明 WS ATLAS 收集哪些个人数据、如何使用它们，以及你依据 GDPR 享有的权利。",
      sections: [
        {
          heading: "合规",
          paragraphs: [
            "本站由个人运营者面向社区提供服务，按照《通用数据保护条例》（GDPR）的原则处理个人数据：目的限定、数据最小化、透明与安全。",
          ],
        },
        {
          heading: "收集的数据",
          paragraphs: [
            "账户：登录邮箱、公开显示名和密码。密码只以 PBKDF2 哈希形式存储，任何人都无法读取明文。",
            "投稿：你提交的地图或 Mod 的内容、文件与元数据会存储在本站，用于审核与发布流程。",
          ],
        },
        {
          heading: "Cookie",
          paragraphs: [
            "本站只使用两类必要 cookie：atlas_session（维持登录会话）与 atlas_locale（记住界面语言偏好）。不使用任何追踪器、统计脚本或广告。",
          ],
        },
        {
          heading: "目的",
          paragraphs: [
            "数据仅用于：识别投稿者并管理权限、运行投稿与审核流程、防止滥用（限流），以及维持你选择的语言与登录状态。",
          ],
        },
        {
          heading: "保存期限",
          paragraphs: [
            "账户数据保存至你删除账户或提出删除请求为止；投稿内容保存至你撤回稿件或要求删除为止。法律法规要求的例外情形另行处理。",
          ],
        },
        {
          heading: "安全",
          paragraphs: [
            "本站通过 HTTPS 传输，密码以 PBKDF2 哈希存储，登录与投稿接口均设有限流；待审核内容仅作者与管理员可见。",
          ],
        },
        {
          heading: "你的权利",
          paragraphs: [
            "你可以通过 adrien.remond@protonmail.com 行使访问、更正、删除与数据可携带的权利。我们会尽快答复每一项请求。",
          ],
        },
        {
          heading: "法律依据",
          paragraphs: [
            "数据处理基于：你的同意（语言偏好等设置），以及执行服务所必需的处理（账户、投稿、审核与安全）。",
          ],
        },
      ],
    },
    en: {
      title: "Privacy policy",
      updated: "2026-09-23",
      intro:
        "This policy describes the personal data collected by WS ATLAS, how it is used, and the rights you have under the GDPR.",
      sections: [
        {
          heading: "Compliance",
          paragraphs: [
            "This site is run by an individual operator for the community and processes personal data according to the principles of the General Data Protection Regulation (GDPR): purpose limitation, data minimisation, transparency and security.",
          ],
        },
        {
          heading: "Data we collect",
          paragraphs: [
            "Account: sign-in email, public display name and password. The password is stored only as a PBKDF2 hash; nobody can read it in clear text.",
            "Submissions: the content, files and metadata of the maps or mods you submit are stored on the site for the review and publication workflow.",
          ],
        },
        {
          heading: "Cookies",
          paragraphs: [
            "The site only uses two essential cookies: atlas_session (to keep your sign-in session) and atlas_locale (to remember your interface language preference). No trackers, analytics scripts or advertising are used.",
          ],
        },
        {
          heading: "Purposes",
          paragraphs: [
            "Data is used only to: identify contributors and manage permissions, run the submission and review workflows, prevent abuse (rate limiting), and keep your chosen language and signed-in state.",
          ],
        },
        {
          heading: "Retention",
          paragraphs: [
            "Account data is kept until you delete your account or request erasure; submitted content is kept until you withdraw it or request deletion. Exceptions required by law are handled separately.",
          ],
        },
        {
          heading: "Security",
          paragraphs: [
            "The site is served over HTTPS, passwords are hashed with PBKDF2, and the sign-in and submission endpoints are rate-limited; pending content is visible only to its author and to administrators.",
          ],
        },
        {
          heading: "Your rights",
          paragraphs: [
            "You can exercise your rights of access, rectification, erasure and data portability by writing to adrien.remond@protonmail.com. Every request receives a reply as soon as possible.",
          ],
        },
        {
          heading: "Legal basis",
          paragraphs: [
            "Processing relies on: your consent (settings such as the language preference) and the necessity of performing the service (account, submissions, moderation and security).",
          ],
        },
      ],
    },
    fr: {
      title: "Confidentialité",
      updated: "2026-09-23",
      intro:
        "Cette politique décrit les données personnelles collectées par WS ATLAS, leur utilisation et les droits dont vous disposez au titre du RGPD.",
      sections: [
        {
          heading: "Conformité",
          paragraphs: [
            "Ce site, exploité par un opérateur individuel au service de la communauté, traite les données personnelles selon les principes du Règlement général sur la protection des données (RGPD) : limitation des finalités, minimisation des données, transparence et sécurité.",
          ],
        },
        {
          heading: "Données collectées",
          paragraphs: [
            "Compte : e-mail de connexion, nom d'affichage public et mot de passe. Le mot de passe n'est stocké que sous forme de hachage PBKDF2 ; personne ne peut le lire en clair.",
            "Soumissions : les contenus, fichiers et métadonnées des cartes ou mods que vous soumettez sont conservés sur le site pour les étapes de modération et de publication.",
          ],
        },
        {
          heading: "Cookies",
          paragraphs: [
            "Le site n'utilise que deux cookies strictement nécessaires : atlas_session (session de connexion) et atlas_locale (préférence de langue de l'interface). Aucun traceur, outil de mesure d'audience ou publicité n'est présent.",
          ],
        },
        {
          heading: "Finalités",
          paragraphs: [
            "Les données servent uniquement à : identifier les contributeurs et gérer les droits, faire fonctionner les flux de soumission et de modération, prévenir les abus (limitation de débit), et conserver votre langue choisie ainsi que votre état de connexion.",
          ],
        },
        {
          heading: "Durée de conservation",
          paragraphs: [
            "Les données de compte sont conservées jusqu'à la suppression du compte ou jusqu'à votre demande ; les contenus soumis le sont jusqu'à leur retrait ou à une demande de suppression. Les exceptions exigées par la loi font l'objet d'un traitement spécifique.",
          ],
        },
        {
          heading: "Sécurité",
          paragraphs: [
            "Le site est servi en HTTPS, les mots de passe sont hachés avec PBKDF2 et les points d'accès à la connexion et aux soumissions sont soumis à une limitation de débit ; les contenus en attente ne sont visibles que de leur auteur et des administrateurs.",
          ],
        },
        {
          heading: "Vos droits",
          paragraphs: [
            "Vous pouvez exercer vos droits d'accès, de rectification, d'effacement et de portabilité en écrivant à adrien.remond@protonmail.com. Chaque demande reçoit une réponse dans les meilleurs délais.",
          ],
        },
        {
          heading: "Base légale",
          paragraphs: [
            "Les traitements reposent sur : votre consentement (réglages tels que la préférence de langue) et la nécessité d'exécuter le service (compte, soumissions, modération et sécurité).",
          ],
        },
      ],
    },
  },
  terms: {
    zh: {
      title: "使用条款",
      updated: "2026-09-23",
      intro: "使用 WS ATLAS 即表示你接受以下条件；这些条件约束网站提供的全部服务。",
      sections: [
        {
          heading: "条件的接受",
          paragraphs: [
            "访问或使用本站（浏览、投稿、下载或使用 Mod 工作台）即表示你已阅读并接受本条件。若不接受，请停止使用本站。",
          ],
        },
        {
          heading: "账户",
          paragraphs: [
            "注册时提供的信息必须准确。你对自己的登录凭据保密负责；通过你账户进行的操作视为你本人的行为。发现账户被盗用，请立即联系站长。",
          ],
        },
        {
          heading: "投稿与社区内容",
          paragraphs: [
            "你只能提交自己创作或已获明确授权的内容；投稿即声明你拥有所需的权利。",
            "投稿即授予本站一项非排他性许可：为运行服务（存储、审核、在档案中展示与分发）而托管并展示该内容。内容的署名权始终归你。",
            "每份投稿都要经过四项人工检查：授权核对、文件内容检查、在标注版本中实测，以及说明一致性检查；全部通过后方可发布。",
            "禁止提交违法内容、侵犯第三方权利的内容、仇恨或骚扰内容以及垃圾信息。违规稿件会被拒绝或下架，相关账户可能受到限制。",
          ],
        },
        {
          heading: "Mod 工作台",
          paragraphs: [
            "工作台导出的文件属于玩家自制 Mod，仅用于在私人对局中测试；本站不提供任何官方认证。在游戏中使用导出内容的责任由你自行承担。",
          ],
        },
        {
          heading: "可用性",
          paragraphs: [
            "本站按“现状”提供服务，不保证服务不中断或无错误；功能可能随时调整、暂停或终止。",
          ],
        },
        {
          heading: "责任限制",
          paragraphs: [
            "在法律允许的最大范围内，站长不对间接损失承担责任，包括因使用本站或其内容（含下载的地图与 Mod）导致的游戏内损失或数据丢失。",
          ],
        },
        {
          heading: "适用法律",
          paragraphs: [
            "本条件受法国法律管辖；与网站相关的争议在法律允许的范围内提交有管辖权的法国法院。",
          ],
        },
        {
          heading: "条件的变更",
          paragraphs: [
            "本条件可能随网站演进而更新；重要变更会通过页面公告提示。更新后继续使用本站即视为接受新版本。",
          ],
        },
      ],
    },
    en: {
      title: "Terms of use",
      updated: "2026-09-23",
      intro:
        "By using WS ATLAS you accept the conditions below; they govern all services provided by the site.",
      sections: [
        {
          heading: "Acceptance of the terms",
          paragraphs: [
            "Accessing or using the site (browsing, submitting, downloading or using the mod workbench) means you have read and accepted these terms. If you do not accept them, please stop using the site.",
          ],
        },
        {
          heading: "Accounts",
          paragraphs: [
            "The information provided at sign-up must be accurate. You are responsible for keeping your credentials confidential; actions taken through your account are deemed to be yours. If your account is taken over, contact the operator immediately.",
          ],
        },
        {
          heading: "Submissions and community content",
          paragraphs: [
            "You may only submit content you created or are clearly authorized to share; submitting declares that you hold the required rights.",
            "Submitting grants the site a non-exclusive license: to host and display your content as part of operating the service (storage, review, presentation in the archive and distribution). Authorship of the content always remains yours.",
            "Every submission goes through four manual checks: authorization review, file content inspection, an in-game test on the stated version, and a consistency check of the descriptions; publication happens only once all checks pass.",
            "Illegal content, content infringing third-party rights, hateful or harassing content and spam are prohibited. Non-compliant submissions are rejected or taken down, and the account concerned may be restricted.",
          ],
        },
        {
          heading: "Mod workbench",
          paragraphs: [
            "Files exported from the workbench are player-made mods intended to be tested in private matches; the site provides no official certification of any kind. Using exported content in game is at your own responsibility.",
          ],
        },
        {
          heading: "Availability",
          paragraphs: [
            'The site is provided on an "as is" basis, with no guarantee of uninterrupted or error-free service; features may be changed, suspended or discontinued at any time.',
          ],
        },
        {
          heading: "Limitation of liability",
          paragraphs: [
            "To the maximum extent permitted by law, the operator is not liable for indirect damages, including in-game losses or data loss resulting from the use of the site or its content (including downloaded maps and mods).",
          ],
        },
        {
          heading: "Governing law",
          paragraphs: [
            "These terms are governed by French law; disputes relating to the site fall, to the extent permitted by law, under the competent French courts.",
          ],
        },
        {
          heading: "Changes to the terms",
          paragraphs: [
            "These terms may be updated as the site evolves; significant changes are announced on the pages. Continuing to use the site after an update means accepting the new version.",
          ],
        },
      ],
    },
    fr: {
      title: "Conditions d'utilisation",
      updated: "2026-09-23",
      intro:
        "En utilisant WS ATLAS, vous acceptez les conditions ci-dessous ; elles encadrent l'ensemble des services proposés par le site.",
      sections: [
        {
          heading: "Acceptation des conditions",
          paragraphs: [
            "Accéder au site ou l'utiliser (consultation, soumission, téléchargement ou usage de l'atelier Mod) vaut lecture et acceptation des présentes conditions. À défaut, cessez d'utiliser le site.",
          ],
        },
        {
          heading: "Comptes",
          paragraphs: [
            "Les informations fournies à l'inscription doivent être exactes. Vous êtes responsable de la confidentialité de vos identifiants ; toute action effectuée depuis votre compte est réputée être la vôtre. En cas d'usurpation de votre compte, contactez l'exploitant sans délai.",
          ],
        },
        {
          heading: "Soumissions et contenus communautaires",
          paragraphs: [
            "Vous ne pouvez soumettre que des contenus de votre création ou dûment autorisés ; toute soumission vaut déclaration que vous détenez les droits nécessaires.",
            "Soumettre accorde au site une licence non exclusive : héberger et afficher votre contenu dans le cadre du service (stockage, modération, présentation dans l'archive et diffusion). La paternité du contenu vous appartient toujours.",
            "Chaque soumission passe quatre contrôles humains : vérification des autorisations, examen du contenu des fichiers, test en jeu sur la version indiquée et contrôle de la cohérence des descriptions ; la publication n'intervient qu'une fois ces contrôles passés.",
            "Sont interdits : les contenus illégaux, les contenus contrefaisants portant atteinte aux droits de tiers, les contenus haineux ou harcelants, ainsi que le spam. Les soumissions non conformes sont refusées ou retirées, et le compte concerné peut être limité.",
          ],
        },
        {
          heading: "Atelier Mod",
          paragraphs: [
            "Les fichiers exportés depuis l'atelier sont des mods réalisés par des joueurs, destinés à être testés en partie privée ; le site ne délivre aucune certification officielle. L'utilisation des contenus exportés en jeu relève de votre responsabilité.",
          ],
        },
        {
          heading: "Disponibilité",
          paragraphs: [
            "Le site est fourni « en l'état », sans garantie de continuité ni d'absence d'erreur ; des fonctionnalités peuvent être modifiées, suspendues ou arrêtées à tout moment.",
          ],
        },
        {
          heading: "Limitation de responsabilité",
          paragraphs: [
            "Dans la mesure maximale permise par la loi, l'exploitant n'est pas responsable des dommages indirects, notamment les pertes en jeu ou les pertes de données résultant de l'utilisation du site ou de ses contenus (cartes et mods téléchargés inclus).",
          ],
        },
        {
          heading: "Droit applicable",
          paragraphs: [
            "Les présentes conditions sont soumises au droit français ; les litiges relatifs au site relèvent, dans la mesure permise par la loi, des tribunaux français compétents.",
          ],
        },
        {
          heading: "Évolution des conditions",
          paragraphs: [
            "Les présentes conditions peuvent évoluer avec le site ; les changements importants sont signalés par une annonce sur les pages. Poursuivre l'utilisation du site après une mise à jour vaut acceptation de la nouvelle version.",
          ],
        },
      ],
    },
  },
};
