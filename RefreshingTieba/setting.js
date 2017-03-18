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
flashlcs
icons
asidead
platformweal
headrecom
spreadad
asidead
score
icon
localpbtop
fakegif
localposter
interaction
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
`);
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
            "user/widget/interaction": {
                _resetDataObj: noop
            },
            "puser/widget/Interaction": {
                _resetDataObj: noop
            },
            "ihome/widget/Interaction": {
                _resetDataObj: noop
            },
            "props/widget/Residual": {
                showUI: emptyStr
            },
            "tbui/widget/tbshare_popup": {
                setShareContent: noop
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