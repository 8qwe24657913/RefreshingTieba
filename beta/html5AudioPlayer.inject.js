'use strict'
/* exported html5AudioPlayer */
function html5AudioPlayer(noop, emptyStr) {
    'use strict'
    return {
        defaultOptions: {},
        isReady: false,
        isPlaying: false,
        isMute: false,
        volume: undefined,
        url: '',
        initial(options) {
            this.options = Object.assign({}, this.defaultOptions, options)
            this.audio = document.createElement('audio')
            this.audio.setAttribute('autoplay', 'false')
            this.audio.setAttribute('preload', 'metadata')
            window.pl = this
            this.isReady = true
            this.bindEvents()
            setTimeout(() => this.trigger('playerloaded', this), 0)
        },
        onSwfLoaded: noop,
        renderSwf: emptyStr,
        bindEvents() {
            this.bind('reset', this._reset, this)
            this.bind('load', this._load, this)
            this.bind('play', this._play, this)
            this.bind('pause', this._pause, this)
            this.bind('stop', this._stop, this)
            this.bind('setmute', this._setMute, this)
        },
        _reset() {
            this._stop()
            this.audio.removeAttribute('src')
            this.url = ''
            this.isPlaying = false
        },
        _load(t, url, success, fail) {
            this.url = url
            if (this.failHandler) {
                clearTimeout(this.failHandler)
            }

            const listener = () => {
                this.audio.removeEventListener('canplaythrough', listener, false)
                this.trigger('songloaded', this._getLoadedPercent())
                if (this.failHandler) clearTimeout(this.failHandler)
                if (success) success()
            }
            this.failHandler = setTimeout(() => {
                this.audio.removeEventListener('canplaythrough', listener, false)
                if (fail) {
                    fail()
                }
            }, 5e3)
            this.audio.addEventListener('canplaythrough', listener, false)
            console.log('[清爽贴吧]播放语音: ', url)
            this.audio.src = url
        },
        _play(t, updateTotal, updateTime, finish) {
            if (this.isPlaying) return
            this.audio.play()
            if (this.checkFinishedHandler) {
                clearTimeout(this.checkFinishedHandler)
            }
            this.isPlaying = true
            if (updateTotal) {
                updateTotal({
                    totalTime: this._getTotalTime(),
                })
            }
            const getTime = () => {
                if (updateTime) {
                    const currentTime = this._getCurrentTime()
                    const totalTime = this._getTotalTime()
                    updateTime({
                        currentTime,
                        totalTime,
                        percent: currentTime / totalTime,
                    })
                }
                if (this.audio.ended) {
                    this.trigger('playfinish', 1)
                    if (finish) finish()
                } else {
                    setTimeout(getTime, 500)
                }
            }
            this.checkFinishedHandler = setTimeout(getTime, 1e3)
        },
        _pause() {
            if (this.isPlaying) {
                this.audio.pause()
                this.isPlaying = false
            }
        },
        _stop() {
            this.audio.pause()
            if (this.checkFinishedHandler) {
                clearTimeout(this.checkFinishedHandler)
            }
            this.isPlaying = false
        },
        _setMute(t, isMute) {
            this.audio.muted = this.isMute = isMute
        },
        _setVolume(t, volume) {
            this.volume = volume
            this.audio.volume = volume / 100
        },
        _setCurrentPosition() {},
        _getCurrentPosition() {
            return this._getCurrentTime() / this._getDurationSec()
        },
        _getLoadedPercent() {
            return this.audio.buffered.end(this.audio.buffered.length - 1) / this._getDurationSec()
        },
        _getDurationSec() {
            const duration = this.audio.duration
            return duration !== Infinity ? duration : 10000 * 60 // fake time
        },
        _getTotalTime() {
            return this._getDurationSec() * 1000
        },
        _getCurrentTimeSec() {
            return this.audio.currentTime
        },
        _getCurrentTime() {
            return this._getCurrentTimeSec() * 1000
        },
    }
}
