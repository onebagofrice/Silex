
/**
 * Silex, live web creation
 * http://projects.silexlabs.org/?/silex/
 *
 * Copyright (c) 2012 Silex Labs
 * http://www.silexlabs.org/
 *
 * Silex is available under the GPL license
 * http://www.silexlabs.org/silex/silex-licensing/
 */

/**
 * @fileoverview
 *   This class represents a File opened by Silex,
 *   which is rendered by the Stage class
 *   It has methods to manipulate the File
 */

goog.provide('silex.model.File');
goog.require('silex.Config');
goog.require('silex.service.SilexTasks');



/**
 * @constructor
 * @param  {silex.types.Model} model  model class which holds the other models
 * @param  {silex.types.View} view  view class which holds the other views
 */
silex.model.File = function(model, view) {
  // store the model and the view
  /**
   * @type {silex.types.Model}
   */
  this.model = model;
  /**
   * @type {silex.types.View}
   */
  this.view = view;
  // store the iframe window and document
  /**
   * the iframe element
   * @type {!HTMLIFrameElement}
   * @private
   */
  this.iFrameElement_ = /** @type {!HTMLIFrameElement} */ (goog.dom.getElementByClass(silex.view.Stage.STAGE_CLASS_NAME));


  /**
   * iframe document
   * @type {Document}
   * @private
   */
  this.contentDocument_ = goog.dom.getFrameContentDocument(this.iFrameElement_);


  /**
   * iframe window
   * @type {Window}
   * @private
   */
  this.contentWindow_ = goog.dom.getFrameContentWindow(this.iFrameElement_);


  // reset iframe content
  // this is needed since iframes can keep their content
  // after a refresh in firefox
  this.contentDocument_.open();
  this.getContentDocument().write('');
  this.contentDocument_.close();
};


/**
 * max number of items in recent files
 * @const
 */
silex.model.File.MAX_RECENT_FILES = 5;


/**
 * loading css class
 * @const
 */
silex.model.File.LOADING_CSS_CLASS = 'loading-website';


/**
 * loading css class
 * @const
 */
silex.model.File.LOADING_LIGHT_CSS_CLASS = 'loading-website-light';


/**
 * current file url and path and info returned by CE
 * if the current file is a new file, it has no fileInfo
 * if set, this is an absolute URL, use silex.model.File::getFileInfo to get the relatvie URL
 * @type {?FileInfo}
 */
silex.model.File.prototype.fileInfo = null;


/**
 * true if the opened file is a template
 * this means that one must "save as" and not "save"
 * @type {boolean}
 */
silex.model.File.prototype.isTemplate = false;


/**
 * the get the iframe element
 * @return {HTMLIFrameElement}
 */
silex.model.File.prototype.getIFrameElement = function() {
  return this.iFrameElement_;
};


/**
 * get the iframe document
 * @return {Document}
 */
silex.model.File.prototype.getContentDocument = function() {
  return this.contentDocument_;
};


/**
 * get the iframe window
 * @return {Window}
 */
silex.model.File.prototype.getContentWindow = function() {
  return this.contentWindow_;
};


/**
 * @return {boolean} true if a website is being edited
 */
silex.model.File.prototype.hasContent = function() {
  return !!this.contentDocument_.body && this.contentDocument_.body.childNodes.length > 0;
};


/**
 * build the html content
 * Parse the raw html and fill the bodyElement and headElement
 * @param {string} rawHtml
 * @param {?function()=} opt_cbk
 * @param {?boolean=} opt_showLoader
 * @param {?boolean=} opt_bypassBC if true will bypass backward compat check, default is true
 * @export
 */
silex.model.File.prototype.setHtml = function(rawHtml, opt_cbk, opt_showLoader, opt_bypassBC) {
  // reset iframe content
  this.contentDocument_.open();
  this.getContentDocument().write('');
  this.contentDocument_.close();
  // loading
  if (opt_showLoader !== false) {
    goog.dom.classlist.add(this.view.stage.element, silex.model.File.LOADING_CSS_CLASS);
  }
  else {
    goog.dom.classlist.add(this.view.stage.element, silex.model.File.LOADING_LIGHT_CSS_CLASS);
  }
  if (typeof(opt_bypassBC) === 'undefined') {
    opt_bypassBC = true;
  }
  // cleanup
  this.model.body.setEditable(this.contentDocument_.body, false);
  this.view.stage.removeEvents(this.contentDocument_.body);
  // add base tag from the beginning
  // should not be needed since we change all  the URLs to absolute
  // but just in case abs/rel conversion bugs
  if (this.fileInfo) {
    rawHtml = rawHtml.replace('<head>', '<head><base class="' + silex.model.Head.SILEX_TEMP_TAGS_CSS_CLASS + '" href="' + this.fileInfo.url + '" target="_blank">');
  }
  // remove user's head tag before it is interprated by the browser
  // - in case it has bad HTML tags, it could break the whole site, insert tags into the body instead of the head...
  rawHtml = this.model.head.extractUserHeadTag(rawHtml);
  // prepare HTML
  rawHtml = this.model.element.prepareHtmlForEdit(rawHtml);
  // make everything protocol agnostic to avoid problems with silex being https
  rawHtml = rawHtml.replace('http://', '//', 'g');
  // detect non-silex websites
  if (rawHtml.indexOf('silex-runtime') < 0) {
    console.error('This is not a website editable in Silex.');
    silex.utils.Notification.alert('I can not open this website. I can only open website made with Silex. <a target="_blank" href="https://github.com/silexlabs/Silex/issues/282">More info here</a>.', function() {});
    return;
  }
  else if (rawHtml.indexOf('silex-published') >= 0) {
    console.error('This is a published website.');
    silex.utils.Notification.alert('I can not open this website. It is a published version of a Silex website. <a target="_blank" href="https://github.com/silexlabs/Silex/issues/282">More info here</a>.', function() {});
    return;
  }
  // remove the "silex-runtime" css class from the body while editing
  // this must be done before rendering the dom, because it is used in front-end.js
  rawHtml = rawHtml.replace(/<body(.*)(silex-runtime).*>/, function(match, p1, p2) {
    if (p1.indexOf('>') >= 0) {
      return match;
    }
    return match.replace('silex-runtime', '');
  }, 'g');
  // write the content
  this.contentDocument_.open();
  this.contentDocument_.write(rawHtml);
  this.contentDocument_.close();
  this.contentChanged(!!opt_bypassBC, opt_cbk);
};



/**
 * the content of the iframe changed
 * @param {boolean} bypassBC if true will bypass backward compat check
 * @param {?function()=} opt_cbk
 */
silex.model.File.prototype.contentChanged = function(bypassBC, opt_cbk) {
  // wait for the webste to be loaded
  // can not rely on the load event of the iframe because there may be missing assets
  this.contentDocument_ = goog.dom.getFrameContentDocument(this.iFrameElement_);
  this.contentWindow_ = goog.dom.getFrameContentWindow(this.iFrameElement_);
  if (this.contentDocument_.body === null ||
    this.contentWindow_ === null ||
    this.contentWindow_['$'] === null) {
    setTimeout(goog.bind(function() {
      this.contentChanged(bypassBC, opt_cbk);
    }, this), 0);
    return;
  }

  // include edition tags and call onContentLoaded
  // the first time, it takes time to load the scripts
  // the second time, no load event, and jquery is already loaded

  // first time in chrome, and always in firefox
  // load scripts for edition in the iframe
  this.includeEditionTags(goog.bind(function() {
    if(bypassBC) {
      this.onContentLoaded(false, opt_cbk);
    }
    else {
      // handle retrocompatibility issues
      silex.utils.BackwardCompat.process(this.contentDocument_, this.model, (needsReload) => {
        this.onContentLoaded(needsReload, opt_cbk);
      });
    }
  }, this), goog.bind(function() {
    // error loading editable script
    console.error('error loading editable script');
    throw new Error('error loading editable script');
  }, this));
};


/**
 * content successfully changed in the iframe
 * @param {boolean} needsReload
 * @param {?function()=} opt_cbk
 */
silex.model.File.prototype.onContentLoaded = function(needsReload, opt_cbk) {
  // check the integrity and store silex style sheet which holds silex elements styles
  this.model.property.initStyles(this.contentDocument_);
  this.model.property.loadProperties(this.contentDocument_);
  // select the body
  this.model.body.setSelection([this.contentDocument_.body]);
  // make editable again
  this.model.body.setEditable(this.contentDocument_.body, true);
  // update text editor with the website custom styles and script
  this.model.head.setHeadStyle(this.model.head.getHeadStyle());
  this.model.head.setHeadScript(this.model.head.getHeadScript());
  // update the settings
  this.model.head.updateFromDom();
  // restore event listeners
  this.view.stage.initEvents(this.contentWindow_);
  // notify the caller
  if (opt_cbk) {
    opt_cbk();
  }
  // if backward compat says it needs reload
  if(needsReload) {
    console.warn('backward compat needs reload');
    this.setHtml(this.getHtml());
    return;
  }
  // loading
  goog.dom.classlist.remove(this.view.stage.element, silex.model.File.LOADING_CSS_CLASS);
  goog.dom.classlist.remove(this.view.stage.element, silex.model.File.LOADING_LIGHT_CSS_CLASS);
  // refresh the view
  var page = this.model.page.getCurrentPage();
  this.model.page.setCurrentPage(page);
  // remove publication path for templates
  if(this.isTemplate) this.model.head.setPublicationPath(null);

  // // refresh the view again
  // // workaround for a bug where no page is opened after open a website or undo
  // setTimeout(goog.bind(function() {
  //   var page = this.model.page.getCurrentPage();
  //   this.model.page.setCurrentPage(page);
  //   setTimeout(goog.bind(function() {
  //     // and again after a while because sometimes shit happens (but where?)
  //     this.model.page.setCurrentPage(page);
  //   }, this), 300);
  // }, this), 100);
};


/**
 * load all scripts needed for edit and display
 * in the iframe
 * WARNING:
 *    this is not used when the scripts are cached by the browser (see how this method is called, only the 1st time the website is loaded)
 * @param {?function()=} opt_onSuccess
 * @param {?function()=} opt_onError
 */
silex.model.File.prototype.includeEditionTags = function(opt_onSuccess, opt_onError) {
  var tags = [];
  // css tags
  var styles = [
    'css/editable.css'
  ];
  goog.array.forEach(styles, function(url) {
    var tag = this.contentDocument_.createElement('link');
    tag.rel = 'stylesheet';
    tag.href = silex.utils.Url.getAbsolutePath(url, window.location.href);
    tags.push(tag);
  }, this);
  // load all tags
  this.model.head.addTempTag(tags, opt_onSuccess, opt_onError);
};


/**
 * build a string of the raw html content
 * remove all internal objects and attributes
 */
silex.model.File.prototype.getHtml = function() {
  // clone
  var cleanFile = /** @type {Node} */ (this.contentDocument_.cloneNode(true));
  // update style tag (the dom do not update automatically when we change document.styleSheets)
  this.model.property.updateStylesInDom(/** @type {Document} */ (cleanFile));
  this.model.property.saveProperties(this.contentDocument_);
  // cleanup
  this.model.head.removeCurrentPageStyleTag(/** @type {Document} */ (cleanFile).head);
  this.model.head.removeTempTags(/** @type {Document} */ (cleanFile).head);
  this.model.body.removeEditableClasses(/** @type {!Element} */ (cleanFile));
  silex.utils.Style.removeInternalClasses(/** @type {!Element} */ (cleanFile), false, true);
  silex.utils.DomCleaner.cleanupFirefoxInlines(this.contentDocument_);
  // reset the style set by stage on the body
  goog.style.setStyle(/** @type {Document} */ (cleanFile).body, 'minWidth', '');
  goog.style.setStyle(/** @type {Document} */ (cleanFile).body, 'minHeight', '');
  // put back the "silex-runtime" css class after editing
  goog.dom.classlist.add(/** @type {Document} */ (cleanFile).body, 'silex-runtime');
  // get html
  var rawHtml = /** @type {Document} */ (cleanFile).documentElement.innerHTML;
  // add the outer html (html tag)
  rawHtml = '<html>' + rawHtml + '</html>';
  // add doctype
  rawHtml = '<!DOCTYPE html>' + rawHtml;
  // cleanup HTML
  rawHtml = this.model.element.unprepareHtmlForEdit(rawHtml);
  // add the user's head tag
  rawHtml = this.model.head.insertUserHeadTag(rawHtml);
  // beutify html
  rawHtml = window['html_beautify'](rawHtml);
  return rawHtml;
};


/**
 * async verion of getHtml
 * this is an optimisation needed to speedup drag start (which creates an undo point)
 * it uses generator to lower the load induced by these operations
 */
silex.model.File.prototype.getHtmlAsync = function (cbk) {
  var generator = this.getHtmlGenerator();
  this.getHtmlNextStep(cbk, generator);
};


/**
 * does one more step of the async getHtml process
 */
silex.model.File.prototype.getHtmlNextStep = function (cbk, generator) {
  let res = generator.next();
  if(res.done) {
    setTimeout(() => cbk(res.value), 100);
  }
  else {
    setTimeout(() => this.getHtmlNextStep(cbk, generator), 100);
  }
};


/**
 * the async getHtml process
 * yield after each step
 */
silex.model.File.prototype.getHtmlGenerator = function* () {
  // update style tag (the dom do not update automatically when we change document.styleSheets)
  let updatedStyles = this.model.property.getAllStyles(this.contentDocument_);
  this.model.property.saveProperties(this.contentDocument_);
  // clone
  var cleanFile = /** @type {Node} */ (this.contentDocument_.cloneNode(true));
  yield;
  var styleTag = cleanFile.querySelector('.' + silex.model.Property.INLINE_STYLE_TAG_CLASS_NAME);
  styleTag.innerHTML = updatedStyles;
  yield;
  // cleanup
  this.model.head.removeCurrentPageStyleTag(/** @type {Document} */ (cleanFile).head);
  this.model.head.removeTempTags(/** @type {Document} */ (cleanFile).head);
  yield;
  this.model.body.removeEditableClasses(/** @type {!Element} */ (cleanFile));
  yield;
  silex.utils.Style.removeInternalClasses(/** @type {!Element} */ (cleanFile), false, true);
  yield;
  silex.utils.DomCleaner.cleanupFirefoxInlines(this.contentDocument_);
  yield;
  // reset the style set by stage on the body
  goog.style.setStyle(/** @type {Document} */ (cleanFile).body, 'minWidth', '');
  yield;
  goog.style.setStyle(/** @type {Document} */ (cleanFile).body, 'minHeight', '');
  yield;
  // put back the "silex-runtime" css class after editing
  goog.dom.classlist.add(/** @type {Document} */ (cleanFile).body, 'silex-runtime');
  yield;
  // get html
  var rawHtml = /** @type {Document} */ (cleanFile).documentElement.innerHTML;
  yield;
  // add the outer html (html tag)
  rawHtml = '<html>' + rawHtml + '</html>';
  yield;
  // add doctype
  rawHtml = '<!DOCTYPE html>' + rawHtml;
  yield;
  // cleanup HTML
  rawHtml = this.model.element.unprepareHtmlForEdit(rawHtml);
  yield;
  // add the user's head tag
  rawHtml = this.model.head.insertUserHeadTag(rawHtml);
  yield;
  // beutify html
  rawHtml = window['html_beautify'](rawHtml);
  return rawHtml;
};


/**
 * load an arbitrary url as a silex html file
 * will not be able to save
 * @param {string} url
 * @param {?function(string)=} opt_cbk
 * @param  {?function(Object, string)=} opt_errCbk
 * @export
 */
silex.model.File.prototype.openFromUrl = function(url, opt_cbk = null, opt_errCbk = null) {
  this.isTemplate = true;
  silex.service.CloudStorage.getInstance().loadLocal(url,
      goog.bind(function(rawHtml) {
        this.fileInfo = /** @type {FileInfo} */ ({
          isDir: false,
          mime: 'text/html',
          url: url
        });
        // this.setUrl(url);
        if (opt_cbk) {
          opt_cbk(rawHtml);
        }
      }, this), opt_errCbk);
};


/**
 * save a file with a new name
 * @param {FileInfo} fileInfo
 * @param {string} rawHtml
 * @param {function()} cbk receives the raw HTML
 * @param {?function(Object)=} opt_errCbk
 * @export
 */
silex.model.File.prototype.saveAs = function(fileInfo, rawHtml, cbk, opt_errCbk) {
  // save the data
  this.fileInfo = fileInfo;
  this.addToLatestFiles(this.fileInfo);
  this.save(rawHtml, cbk, opt_errCbk);
};


/**
 * write content to the file
 * @param {string} rawHtml
 * @param {function()} cbk
 * @param {?function(Object)=} opt_errCbk
 * @export
 */
silex.model.File.prototype.save = function(rawHtml, cbk, opt_errCbk) {
  if(this.fileInfo == null) throw new Error('Can not save, fileInfo is null');
  silex.service.CloudStorage.getInstance().write(
      /** @type {FileInfo} */ (this.fileInfo),
      rawHtml,
      () => {
        this.isTemplate = false;
        if (cbk) {
          cbk();
        }
      },
      opt_errCbk);
};


/**
 * load a new file
 * @param {FileInfo} fileInfo
 * @param {function(string)} cbk receives the raw HTML
 * @param {?function(Object)=} opt_errCbk (err)
 */
silex.model.File.prototype.open = function(fileInfo, cbk, opt_errCbk) {
  this.isTemplate = false;
  silex.service.CloudStorage.getInstance().read(
      fileInfo,
      (rawHtml) => {
        // update model
        this.close();
        this.fileInfo = fileInfo;
        this.addToLatestFiles(this.fileInfo);
        if (cbk) {
          cbk(rawHtml);
        }
      }, opt_errCbk);
};


/**
 * reset data, close file
 */
silex.model.File.prototype.close = function() {
  this.fileInfo = null;
};


/**
 * get the url of the file
 * @return {?FileInfo}
 */
silex.model.File.prototype.getFileInfo = function() {
  return this.fileInfo;
};


/**
 * clear the recent files
 */
silex.model.File.prototype.clearLatestFiles = function() {
  window.localStorage.removeItem('silex:recent-files');
};


/**
 * get the latest opened files
 * @return {Array.<FileInfo>}
 */
silex.model.File.prototype.getLatestFiles = function() {
  const str = window.localStorage.getItem('silex:recent-files');
  if(str) {
    return (/** @type {Array.<FileInfo>} */ (JSON.parse(str)))
      // remove old URLs from previous CE version
      .filter(fileInfo => fileInfo.name != null);
  }
  else return [];
};


/**
 * store this file in the latest opened files
 * @param {?FileInfo} fileInfo
 */
silex.model.File.prototype.addToLatestFiles = function(fileInfo) {
  // url= http://localhost:6805/api/1.0/github/exec/get/silex-tests/gh-pages/abcd.html
  const latestFiles = this.getLatestFiles();
  // remove if it is already in the array
  // so that it goes back to the top of the list
  let foundIndex = -1;
  latestFiles.forEach((item, idx) => item.url === fileInfo.url ? foundIndex = idx : null);
  if(foundIndex > -1) {
    latestFiles.splice(foundIndex, 1);
  }
  latestFiles.unshift(fileInfo);
  // limit size
  if(latestFiles.length > silex.model.File.MAX_RECENT_FILES) {
    latestFiles.splice(silex.model.File.MAX_RECENT_FILES, latestFiles.length - silex.model.File.MAX_RECENT_FILES);
  }
  window.localStorage.setItem('silex:recent-files', JSON.stringify(latestFiles));
};
