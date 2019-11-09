'use strict'
/* exported initGeeTestService */
function initGeeTestService(noop, emptyStr) {
  'use strict'
  let hookedGeeTest = false
  return function() {
    // 延迟加载极验
    console.log('[清爽贴吧]已延迟加载极验', this.__attr.modulePath)
    const setCallback = () => this.setJiyanCallback()
    if (window.jiyanService) {
      if (hookedGeeTest || !window.jiyanService.jiyanCaptcha) {
        window.jiyanService.onValidateReady(setCallback)
      } else {
        setCallback()
      }
      return
    }
    hookedGeeTest = true
    const initList = [setCallback]

    function verifyHook() {
      for (const init of initList) {
        init()
      }
      window.jiyanService.jiyanCaptcha.verify()
    }
    window.jiyanService = {
      getJiyanChallenge: emptyStr,
      onValidateInitError: noop,
      onValidateAjaxError: noop,
      onValidateClose: noop,
      onValidateSuccess: noop,
      onValidateError: noop,
      onValidateReady(fn) {
        initList.push(fn)
      },
      jiyanCaptcha: {
        verify: () => {
          window.jiyanService = this.requireInstance(
            window.PageData && String(window.PageData.page).includes('pb')
              ? 'pcommon/widget/JiyanService'
              : 'poster/widget/jiyan_service',
          )
          hookedGeeTest = false
          window.jiyanService.getJiyanChallenge = emptyStr
          window.jiyanService.jiyanCaptcha
            ? verifyHook()
            : window.jiyanService.onValidateReady(verifyHook)
        },
      },
    }
  }
}
