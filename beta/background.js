'use strict';
const hostEquals = 'tb1.bdstatic.com';
const pathEquals = '/';
const queryPrefix = '??';
const urlMatches = `(?i)[^,?]*(?:\\b|_)(?:${sensitiveWordsV2.join('|')})_[^,?]*\.(?:js|css),?`;
const resourceType = ['script', 'stylesheet'];

// 去除部分脚本/样式
const extractionRule = {
    id: 'extractionRule',
    priority: 3,
    conditions: [
        new chrome.declarativeWebRequest.RequestMatcher({
            url: {
                hostEquals,
                pathEquals,
                queryPrefix,
                urlMatches,
            },
            resourceType,
        }),
    ],
    actions: [
        new chrome.declarativeWebRequest.RedirectByRegEx({
            from: urlMatches,
            to: '',
        }),
    ]
};
/*
// 正确处理萃取结果最后有 "," 的情况（其实不处理似乎也没问题……
const helperRule1 = {
    id: 'helperRule1',
    priority: 2,
    conditions: [
        new chrome.declarativeWebRequest.RequestMatcher({
            url: {
                hostEquals,
                pathEquals,
                queryPrefix,
                querySuffix: ',',
            },
            resourceType,
        }),
    ],
    actions: [
        new chrome.declarativeWebRequest.RedirectByRegEx({
            from: ',$',
            to: '',
        }),
    ]
};
// 正确处理萃取结果只剩下 "https://tb1.bdstatic.com/??" 的情况
const helperRule2 = {
    id: 'helperRule2',
    priority: 1,
    conditions: [
        new chrome.declarativeWebRequest.RequestMatcher({
            url: {
                hostEquals,
                pathEquals,
                queryEquals: queryPrefix,
            },
            resourceType,
        }),
    ],
    actions: [
        new chrome.declarativeWebRequest.RedirectToEmptyDocument(),
    ]
};
*/
chrome.declarativeWebRequest.onRequest.removeRules(['extractionRule', 'helperRule1', 'helperRule2'], function() {
    chrome.declarativeWebRequest.onRequest.addRules([
        extractionRule,
        //helperRule1,
        //helperRule2,
    ]);
});
