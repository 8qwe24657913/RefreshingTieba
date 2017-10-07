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
var scriptBlackList = [
    /^https?:\/\/fex\.bdstatic\.com\/hunter\/alog\/(alog|dp)\.min\.js(\?|$)/,
    /^https?:\/\/passport\.baidu\.com\/static\/passpc-base\/js\/(dv\/8|ld|fld)\.min\.js(\?|$)/,
    /^https?:\/\/passport\.baidu\.com\/static\/passpc-account\/js\/module\/fingerload\.js(\?|$)/,
].map(rule => rule.flags ? [rule.source] : [rule.source, rule.flags]);
// 屏蔽后需要覆盖原方法的模块
function getSpecialModules(noop, emptyStr) {
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