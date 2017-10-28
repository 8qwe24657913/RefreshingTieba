/*jshint esversion: 6 */
// 是否开启debug模式
var debugMode = false;
// 通用模糊匹配，包含这个词就屏蔽
var sensitiveWords = split(`
encourage
entertainment
hottopic
firework
adsense
dasense
stat
money
game
tcharge
vip
tdou
celebrity
tbmall
wallet
cashier
qianbao
purchase
track
stock
promoter
pay
u9aside
duoku
xiu8
meizhi
adpost
advertise
recommend
props
snowflow
saveface
medal
pkfixedbubble
locality
topicrank
force_login
urlcheck
share
asidead
platformweal
headrecom
spreadad
asidead
score
icon
localpbtop
localposter
comtrial
cpro
pc2client
tenyears
pad_overlay
spageliveshowslide
aside_platform
avideo
tb_gram
live_tv
spread
activity
post_marry
member_out_date_warn
buy_controller
tbean
iframe_head
nameplate
gift
sign_card
conf_skin
confskin
marry
head_recom
headrecom
P0WRqyv
lego
pvFromClient
`);
// 从模板中移除的元素
var selector = join(`
[id="pagelet_frs-aside/pagelet/ad"]
[id*="encourage"]
[id*="entertainment"]
[id*="hottopic"]
[id*="firework"]
[class*="encourage"]
[class*="entertainment"]
[class*="firework"]
.game-head-game-info-wrapper
.game_frs_in_head
.top_iframe
#forum_recommend
#thread_list > li:not(.j_thread_list):not(.thread_top_list_folder)
#thread_list > style
.app_download_box
.activity_head
`);
// bigpipe黑名单，全名
var bigpipeBlackList = split(`
frs-aside/pagelet/ad
`);
// bigpipe白名单，全名
var bigpipeWhiteList = split(`
`);
// module白名单，全名
var moduleWhiteList = split(`
album/component/initApiConfig
`);
// module黑名单，全名
var moduleBlackList = split(`
ueditor/widget/topic_suggestion
puser/widget/myApp
fanclub/widget/fancard
star/widget/crowdfundingTraveling
pfrs/widget/FanspartyAside
ppb/widget/postList/PrintFlower
ppb/widget/specialAutoFocus
puser/widget/ticketWarning
fanclub/widget/fan_aside
pfrs/widget/frs_stamp_notice
`);
var HOSTMAP = {
    "codemonkey.baidu.com": "https://sp1.baidu.com/9bkCaTOb_gsJiBGko9WTAnF6hhy",
    "g.imgsrc.baidu.com": "https://ss0.bdstatic.com/-fo4cT78BgN3otqbppnN2DJv",
    "c.imgsrc.baidu.com": "https://ss0.bdstatic.com/9fo4cT78BgN3otqbppnN2DJv",
    "wbapi.baidu.com": "https://sp2.baidu.com/6bYHfD4a2gU2pMbgoY3K",
    "gx.baidu.com": "https://sp0.baidu.com/-ax1bjeh1BF3odCf",
    "f.hiphotos.baidu.com": "https://ss2.baidu.com/-vo3dSag_xI4khGko9WTAnF6hhy",
    "ecmc.bdimg.com": "https://ss2.bdstatic.com/-0U0b8Sm1A5BphGlnYG",
    "f.imgsrc.baidu.com": "https://ss0.bdstatic.com/-vo4cT78BgN3otqbppnN2DJv",
    "s1.bdstatic.com": "https://ss1.bdstatic.com/5eN1bjq8AAUYm2zgoY3K",
    "e.hiphotos.baidu.com": "https://ss1.baidu.com/-4o3dSag_xI4khGko9WTAnF6hhy",
    "g.hiphotos.baidu.com": "https://ss3.baidu.com/-fo3dSag_xI4khGko9WTAnF6hhy",
    "h.hiphotos.baidu.com": "https://ss0.baidu.com/7Po3dSag_xI4khGko9WTAnF6hhy",
    "b.imgsrc.baidu.com": "https://ss0.bdstatic.com/9vo4cT78BgN3otqbppnN2DJv",
    "c.hiphotos.baidu.com": "https://ss3.baidu.com/9fo3dSag_xI4khGko9WTAnF6hhy",
    "ecma.bdimg.com": "https://ss1.bdstatic.com/-0U0bXSm1A5BphGlnYG",
    "d.hiphotos.baidu.com": "https://ss0.baidu.com/-Po3dSag_xI4khGko9WTAnF6hhy",
    "b.hiphotos.baidu.com": "https://ss1.baidu.com/9vo3dSag_xI4khGko9WTAnF6hhy",
    "a.hiphotos.baidu.com": "https://ss0.baidu.com/94o3dSag_xI4khGko9WTAnF6hhy",
    "wpl.baidu.com": "https://sp2.baidu.com/6aQ_sjip0QIZ8tyhnq",
    "e.imgsrc.baidu.com": "https://ss0.bdstatic.com/-4o4cT78BgN3otqbppnN2DJv",
    "d.hiphotos.bdimg.com": "https://ss3.bdstatic.com/-Po3dSag_xI4khGkpoWK1HF6hhy",
    "bos.lego.baidu.com": "https://ss0.baidu.com/9rkZsjKl1wd3otqbppnN2DJv",
    "e.hiphotos.bdimg.com": "https://ss0.bdstatic.com/-4o3dSag_xI4khGkpoWK1HF6hhy",
    "f.hiphotos.bdimg.com": "https://ss1.bdstatic.com/-vo3dSag_xI4khGkpoWK1HF6hhy",
    "map.baidu.com": "https://sp1.baidu.com/80MWsjip0QIZ8tyhnq",
    "ecmd.bdimg.com": "https://ss0.bdstatic.com/-0U0aHSm1A5BphGlnYG",
    "a.imgsrc.baidu.com": "https://ss0.bdstatic.com/94o4cT78BgN3otqbppnN2DJv",
    "muses.baidu.com": "https://sp0.baidu.com/8_1ZaSna2gU2pMbgoY3K",
    "d.imgsrc.baidu.com": "https://ss0.bdstatic.com/-Po4cT78BgN3otqbppnN2DJv",
    "j.map.baidu.com": "https://sp0.baidu.com/7vo0bSba2gU2pMbgoY3K",
    "api.map.baidu.com": "https://sp2.baidu.com/9_Q4sjOpB1gCo2Kml5_Y_D3",
    "bdimg.share.baidu.com": "https://ss1.baidu.com/9rA4cT8aBw9FktbgoI7O1ygwehsv",
    "b.hiphotos.bdimg.com": "https://ss1.bdstatic.com/9vo3dSag_xI4khGkpoWK1HF6hhy",
    "h.imgsrc.baidu.com": "https://ss0.bdstatic.com/7Po4cT78BgN3otqbppnN2DJv",
    "g.hiphotos.bdimg.com": "https://ss2.bdstatic.com/-fo3dSag_xI4khGkpoWK1HF6hhy",
    "h.hiphotos.bdimg.com": "https://ss2.bdstatic.com/7Po3dSag_xI4khGkpoWK1HF6hhy",
    "c.hiphotos.bdimg.com": "https://ss2.bdstatic.com/9fo3dSag_xI4khGkpoWK1HF6hhy",
    "a.hiphotos.bdimg.com": "https://ss0.bdstatic.com/94o3dSag_xI4khGkpoWK1HF6hhy",
    "bzclk.baidu.com": "https://sp0.baidu.com/9q9JcDHa2gU2pMbgoY3K",
    "ecmb.bdimg.com": "https://ss0.bdstatic.com/-0U0bnSm1A5BphGlnYG",
};
var scriptBlackList = [
    'fex.bdstatic.com/hunter/alog/',
    'passport.baidu.com/static/passpc-base/js/(dv/8|ld|fld).min.js(\\?|$)',
    'passport.baidu.com/static/passpc-account/js/module/fingerload.js(\\?|$)',
    '(' + [...Object.entries(HOSTMAP)].reduce((prev, [http, https]) => prev.concat([http, https.slice(8)]), []).join('|') + ')/',
].map(rule => ('^https?://' + rule).replace(/(\.|\/)/g, '\\$1'));
// 屏蔽后需要覆盖原方法的模块
function getSpecialModules(noop, emptyStr, html5AudioPlayer) {
    'use strict';
    return {
        block: {
            "props/component/PropsApi": {
                showUI: emptyStr,
                showUIHtml: emptyStr
            },
            "puser/component/PropsApi": {
                showUIHtml: emptyStr
            },
            "user/widget/icons": {
                getPreIconHtml: emptyStr,
                getTbvipIconHtml: emptyStr,
                getIconsHtml: emptyStr
            },
            "user/widget/Icons": {
                getPreIconHtml: emptyStr,
                getTbvipIconHtml: emptyStr,
                getIconsHtml: emptyStr
            },
            "puser/widget/icons": {
                getPreIconHtml: emptyStr,
                getTbvipIconHtml: emptyStr,
                getIconsHtml: emptyStr
            },
            "user/widget/month_icon": {
                getMonthIcon: emptyStr
            },
            "puser/widget/MonthIcon": {
                getMonthIcon: emptyStr
            },
            "ihome/widget/MonthIcon": {
                getMonthIcon: emptyStr
            },
            "props/widget/Residual": {
                showUI: emptyStr
            },
            "tbui/widget/tbshare_popup": {
                setShareContent: noop
            },
            "pcommon/widget/pb_track": {
                _track: noop
            },
            "tbmall/component/util": {
                getMaxLevel: function() {
                    return 0;
                }
            },
            "pcommon/widget/AudioPlayer": html5AudioPlayer,
            "tbui/widget/audio_player": html5AudioPlayer,
            "common/widget/AudioPlayer": html5AudioPlayer,
        },
        override: {
            "frs-list/pagelet/thread_list": {
                checkLogin: noop
            },
            "puser/widget/sign_mod_bright": {
                handlePrintFlower: noop
            },
            "tbui/widget/js_redirect": {
                _track: noop
            },
        },
        hook: {
            /*
            "message/widget/chat_content": function(info) {
                if (!info.requires) info.requires = [];
                info.requires.push("common/widget/TbLcs");
                let initial = info.sub.initial;
                info.sub.initial = function(config) {
                    if (!config.lcs.sendMessage) {
                        config.lcs = this.requireInstance("common/widget/TbLcs", []);
                    }
                    return initial.call(this, config);
                }
            }
            */
        }
    };
}
var setting = {
    debugMode,
    sensitiveWords,
    selector,
    bigpipeWhiteList,
    bigpipeBlackList,
    moduleWhiteList,
    moduleBlackList,
    scriptBlackList,
};

function orig(wtf) {
    return wtf;
}

function split(str) {
    return str.split('\n').filter(orig);
}

function join(str) {
    return split(str).join();
}
