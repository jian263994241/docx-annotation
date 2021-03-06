/*
 * @Author: Steve Xu
 * @Date: 2019-01-18 16:00:25
 * @Last Modified by: Steve Xu
 * @Last Modified time: 2019-01-21 13:28:32
 */
import $ from "jquery"
import rangy from "./rangy-core.js"
import "./rangy-classapplier.js"
import "./rangy-highlighter.js"
import mammoth from "mammoth"
const COLOR_BOX_PREFIX = "special-color"
const ACTIVE_CLASS = "active"
const HIGHLIGHT_ID_PREFIX = "highlight_"
const DEFAULT_HIGHLIGHT_ID = "_NaN"
const MAMMOTH_OPTIONS = {
  // 图片全部转换为 base64
  convertImage: mammoth.images.imgElement(image => {
    return image.read("base64").then(imageBuffer => {
      return {
        src: `data:${image.contentType};base64,${imageBuffer}`
      }
    })
  }),
  ignoreEmptyParagraphs: false // 运行空白段落的存在
}
// 开始索引较小的排在前面
const sortMethod = (a, b) => (a > b ? 1 : -1)
const COMMENT_ATTR_KEY = "data-comment-id"
export default {
  name: "docx-annotation",
  props: {
    value: {
      // 批注列表
      type: Array,
      default() {
        return []
      }
    },
    clickScroll: {
      // 是否批注滚动到被批注处,默认不滚动
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      highlightClass: HIGHLIGHT_ID_PREFIX, // 批注高亮 id 前缀
      wordContent: "", // word 转换为 html 的内容
      formData: {
        comment: "", // 批注
        selectText: "", // 被批注内容
        start: "", // 被批注起始位置
        end: "", // 被批注结束位置
        id: "" // 批注id
      },
      highlighter: null,
      commentList: [], // 批注列表
      showComment: true, // 是否显示批注输入框  true 不显示
      containerId: "doc-html__" + +new Date(), // 容器 ID
      commentDetail: "" // 批注详情
    }
  },
  methods: {
    /**
     * 判断是否为空
     * @param {Any} val
     */
    isEmpty(val) {
      return val == null || !(Object.keys(val) || val).length
    },
    /**
     * docx 转换为 html
     * @param {arrayBuffer} arrayBuffer
     */
    wordToHtml(arrayBuffer) {
      this.$emit("convert-start")
      mammoth
        .convertToHtml({ arrayBuffer: arrayBuffer }, MAMMOTH_OPTIONS)
        .then(({ value, messages }) => {
          this.wordContent = value
          let message = messages
            .map(item => this.escapeHtml(item.message))
            .join(",")
          this.$emit("convert-end")
          if (!value) {
            console.error("docx 转换为 html 失败," + message)
          }
          this.initHighlight()
        })
        .done()
    },
    /**
     * 过滤特殊字符
     * @param {String} value
     */
    escapeHtml(value) {
      return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
    },
    /**
     * 初始化高亮区域
     */
    initHighlight() {
      rangy.init()
      this.commentList = this.value
      this.highlighter = rangy.createHighlighter()
      this.ResetClassApplier(COLOR_BOX_PREFIX, "")
      this.highlighter.highlightSelection(COLOR_BOX_PREFIX, {
        containerElementId: this.containerId
      })
      let data = this.commentList

      if (this.isEmpty(data)) {
        return
      }
      for (let item of data) {
        let className = item.class + "_" + item.id
        let highlight = this.highlighter.addHighlight(
          item,
          this.ResetClassApplier(className, item.id),
          this.containerId
        )
        highlight.unapply()
      }
      this.$nextTick(this.activeComment)
    },
    /**
     * 激活复原的批注
     */
    activeComment() {
      this.mouseUpHandler() // 必须调用该方法，否则无法激活，，不知道为什么
      let index = 0
      let item = this.commentList[index]
      if (this.clickScroll) {
        let className = "." + item.class + "_" + item.id
        $(className).addClass(ACTIVE_CLASS)
        $("#highlight_" + item.id).addClass(ACTIVE_CLASS)
      }
      let highlight = this.highlighter.highlights.find(v => v.id === item.id)
      if (highlight) {
        highlight.apply()
      }
      this.saveLastData()
    },
    /**
     * 重置DOM事件，高亮批注
     * @param {String} className
     */
    ResetClassApplier(className, commentId) {
      let _this = this
      let commentDetailClassName = ".comment-detail-info"
      let applier = rangy.createClassApplier(className, {
        ignoreWhiteSpace: true,
        elementProperties: {
          onmouseenter: function(event) {
            let commentId = $(this).attr(COMMENT_ATTR_KEY)
            let offset = $(this).offset()

            let item = _this.commentList.find(v => v.id == commentId)
            if (!item || !item.comment) {
              return
            }
            _this.commentDetail = item.comment
            $(commentDetailClassName)
              .css({
                top: offset.top - 160,
                left: offset.left - 130
              })
              .show()
          },
          onmouseleave: function(event) {
            $(commentDetailClassName).hide()
          }
        },
        elementAttributes: {
          [COMMENT_ATTR_KEY]: commentId
        }
      })
      this.highlighter.addClassApplier(applier)
      return applier
    },
    /**
     * 高亮批注区域
     * @param {String} commentId
     */
    highlightComment(commentId) {
      let curHighlight = this.getCurrentHighlightById(commentId)
      let list = curHighlight.getHighlightElements()
      if (this.isEmpty(list)) {
        return [false, list]
      }
      if (this.clickScroll) {
        $(`[class^="${COLOR_BOX_PREFIX}"].${ACTIVE_CLASS}`).removeClass(
          ACTIVE_CLASS
        )
        for (let item of list) {
          item.classList.add(ACTIVE_CLASS)
        }
        $("#" + HIGHLIGHT_ID_PREFIX + commentId)
          .addClass(ACTIVE_CLASS)
          .siblings("li")
          .removeClass(ACTIVE_CLASS)
      }
      return [true, list]
    },
    /**
     * 鼠标弹起事件处理
     */
    mouseUpHandler() {
      if (this.clickScroll) {
        $(`[class^="${COLOR_BOX_PREFIX}"].${ACTIVE_CLASS}`).removeClass(
          ACTIVE_CLASS
        )
      }

      let root = this.highlighter.highlightSelection(COLOR_BOX_PREFIX, {
        containerElementId: this.containerId
      })
      let selectText = rangy.getSelection().toString()

      if (this.isEmpty(root) || this.isEmpty(selectText)) return false
      let noteTodo = null
      /* 复制 highlight Begin */
      noteTodo = this.highlighter.highlights[
        this.highlighter.highlights.length - 1
      ]
      this.formData = Object.assign(this.formData, {
        selectText,
        start: noteTodo.characterRange.start,
        end: noteTodo.characterRange.end,
        id: +new Date()
      })
      /* 复制 highlight End */
      if (noteTodo.getHighlightElements().length) {
        let offset =
          $(noteTodo.getHighlightElements()[0]).offset().top -
          $("#" + this.containerId).offset().top

        $(".doc-content__note").css("top", offset)
      }
      this.showComment = false
    },

    getCurrentHighlightById(id) {
      if (!id) {
        return null
      }
      return this.highlighter.highlights.find(item => item.id === id)
    },
    /**
     * 确认添加的批注
     */
    submitComment() {
      let formData = this.formData
      if (!formData.comment) return
      let annotation = Object.assign(
        {
          class: COLOR_BOX_PREFIX
        },
        formData
      )
      this.commentList.push(annotation)

      let len = this.highlighter.highlights.length - 1
      let item = this.highlighter.highlights[len]
      item.id = annotation.id
      let className = COLOR_BOX_PREFIX + "_" + annotation.id
      item.classApplier = this.ResetClassApplier(className, annotation.id)
      item.apply()
      $(`[class$="${DEFAULT_HIGHLIGHT_ID}"]`).removeClass()
      this.saveLastData()
      this.showComment = true
      this.resetFormData()
    },
    resetFormData() {
      this.formData = {
        comment: "",
        selectText: "",
        start: "",
        end: ""
      }
    },
    /**
     * 添加时取消批注
     * @param {Number} index
     */
    cancelComment(index) {
      let temp = this.highlighter.highlights
      this.showComment = true
      if (index < 0 || index >= temp.length) {
        index = temp.length - 1
      }
      if (!temp[index]) {
        return
      }
      temp[index].unapply()
      temp.splice(index, 1)
      this.resetFormData()
    },
    /**
     * 删除批注
     * @param {Object} annotation
     */
    deleteComment(annotation) {
      this.commentList = this.commentList.filter(
        item => item.id !== annotation.id
      )
      let list = this.highlighter.highlights
      let index = list.findIndex(item => item.id === annotation.id)
      this.cancelComment(index)
      this.saveLastData()
      console.log("删除成功!")
    },

    /**
     * 调整数据
     */
    saveLastData() {
      let commentList = this.commentList
      commentList.sort((a, b) => {
        return sortMethod(a.start, b.start)
      })
      this.$emit("input", this.commentList)
      this.highlighter.highlights.sort((a, b) => {
        return sortMethod(a.characterRange.start, b.characterRange.start)
      })
      for (let i = 0; i < commentList.length; i++) {
        let item = commentList[i]
        let className = "." + item.class + "_" + item.id
        $(className)
          .last()
          .attr("data-num", `[${i + 1}]`)
      }
    },
    /**
     * 删除所有批注
     */
    clearComment() {
      for (let i = 0; i < this.commentList.length; i++) {
        this.cancelComment(i)
      }
      this.commentList = []
      this.saveLastData()
    },
    /**
     * 高亮被批注区域
     * @param {Object} annotation
     */
    highlightArticle(annotation) {
      if (!this.clickScroll) return
      let commentId = annotation.id
      let [result, list] = this.highlightComment(commentId)
      if (!result) {
        return false
      }
      let root = $(document)
      let commentTop =
        $("#" + HIGHLIGHT_ID_PREFIX + commentId).position().top + 40
      let offsetY = $(list[0]).offset().top
      if (offsetY > commentTop) {
        offsetY -= commentTop
      }
      root.scrollTop(offsetY)
    }
  }
}
