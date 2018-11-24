/*
debug:
  1: node
  2: text
  4: attr
  8: eval
  16: repeat
*/
'use strict';
var Templar;
(function () {
  var _ = templarTools;
  /****************************************************************************/
  var cls = Templar = function (par, tmp, model, ctx) {
    var ist = this, _par = _.elCheck(par), _temp = _.elCheck(tmp);
    function CTX() { };
    Object.defineProperty(CTX.prototype, "model", {
      get: function () { return ist.model; }
    });
    ist.model = model;
    var _ctx = _.oapply(new CTX(), ctx);

    ist.patterns = cls.defaultPatterns;
    ist.modules = cls.defaultModules;

    ist.exec = function () { return _exec(_temp, _ctx, _par); }

    function _exec(e, ctx, par) {
      if (!(e = _.elCheck(e))) return;
      var e2 = e.cloneNode(true);
      _traverse(e2, ctx);
      if (ctx._removeParent) e2 = _.removeParent(e2);
      if (par = _.elCheck(par)) _.append(e2, par);
      return e2;
    }

    function _traverse(e, refctx) {
      if (refctx.debug & 1) console.log('node', _.nodePath(e));
      if (_.isComment(e)) return e;
      if ((e = _.elCheck(e)) === undefined) return;
      var ctx = _.oapply(new CTX(), refctx, e);

      if (_.isNwText(e)) {
        if (ctx.debug & 2) console.log('text', e.nodeName, e.nodeValue);
        _patternLoop(e, 'nodeValue', ctx, '');
      }

      if (e.attributes) for (var i = 0; i < e.attributes.length; i++) {
        var a = e.attributes[i];
        if (ctx.debug & 4) console.log('attr', a.name, a.value);
        _patternLoop(a, 'value', ctx, a.name);
        _moduleLoop(a.name, a.value, e, ctx);
      }

      if (_.isfn(ctx._handleChildren)) ctx._handleChildren(e, ctx, _exec);
      else { // default child functionality, if not overridden
        if (ctx._elBody) {
          e.innerHTML = '';
          e.appendChild(ctx._elBody);
        }
        var ce = e.firstChild;
        while (ce) {
          ce = _traverse(ce, ctx);
          if (ce) ce = ce.nextSibling;
        }
      }

      _.rapply(refctx, ctx);
      return e;
    }

    function _patternLoop(robj, rkey, ctx, name) {
      for (var i = 0; i < ist.patterns.length; i++) {
        var pat = ist.patterns[i];
        robj[rkey] = robj[rkey].replace(pat.rx,
          pat.cb.bind(ist, ctx, name));
      }
    }
    function _moduleLoop(key, value, e, ctx) {
      for (var i = 0; i < ist.modules.length; i++) {
        var mod = ist.modules[i],
          mkey = key.match(mod.rx);
        if (mkey && _.isfn(mod.cb)) mod.cb(mkey, value, e, ctx);
      }
    }
  };

  /****************************************************************************/
  // pattern/module functions
  var curlyPat = {
    rx: /{{\s*(.+?)\s*}}/ig,
    cb: function (ctx, name, all, spath) {
      var ist = this, path = curlyPat.expand(spath, ctx),
        val = curlyPat.eval(path, ctx);
      val = curlyPat.event(path, val, ctx, name);
      if (val === null) val = all;
      return val;
    },
    eventRx: /^on-?/i,
    event: function (path, val, ctx, name) {
      var fn = val, e = ctx._node, ename = '';
      if (_.isfn(val) && curlyPat.eventRx.test(name)) {
        ename = name.replace(curlyPat.eventRx, '');
        val = '';
        e.attributes.removeNamedItem(name); delete e[name];
      } else if (name === 'value' && !e.valueBindApplied && _.elHasAttribute(e, 'value-bind')) {
        ename = 'change'
        fn = curlyPat.cbAutoChange;
      }
      if (ename) {
        console.log('bind', ename, e.nodeName);
        e.addEventListener(ename, fn.bind(e, ctx, path));
      }
      return val;
    },
    cbAutoChange: function (ctx, path) {
      var o = ctx, p = path.slice();
      while (p.length > 1) o = o[p.shift()];
      o[p[0]] = this.value;
      console.log('change-value-bind', this.value, o, p[0]);
    },

    rxPat: /[.\[\]]+/g,
    split: function (path) {
      if (_.isarr(path)) return path;
      else if (_.isstr(path)) return path.split(curlyPat.rxPat);
      else return [];
    },
    join: function (path) {
      if (_.isarr(path)) return path.join('.');
      else if (_.isstr(path)) return path;
      else return '';
    },
    expand: function (spath, ctx, join) {
      var path = curlyPat.split(spath);
      var p0 = path.shift(), o0 = ctx[p0];
      if (p0 !== 'model' && _.isstr(o0) && o0.indexOf('model') === 0)
        path = curlyPat.split(o0).concat(path);
      else path.unshift(p0);
      if (join) return curlyPat.join(path);
      return path;
    },
    eval: function (path, ctx) {
      if (_.isstr(path)) path = curlyPat.expand(path, ctx);
      var o = ctx, p = path.slice(), key, spath = curlyPat.join(path);
      while (key = p.shift()) {
        if (key in o) o = o[key];
        if (typeof o === 'undefined') {
          console.warn('path not found', key, ' - ', spath);
          o = ''; break;
        }
      }
      if (ctx.debug & 8) console.log('eval', spath, o);
      return o;
    },
  };
  var modelMod = {
    rx: /^data-model-([a-z]\w*)$/i,
    cb: function (mkey, value, e, ctx) {
      var key = mkey[1];
      value = value || ctx.lastModel || 'model';
      var path = curlyPat.expand(value, ctx, true);
      ctx[key] = path;
      ctx.lastModel = key;
      return key;
    }
  };
  var tmplMod = {
    rx: /^data-template$/i,
    cb: function (mkey, value, e, ctx) {
      var elBody = _.elCheck(value);
      if (!elBody) console.warn('template', value, 'not found');
      else ctx._elBody = elBody;
    }
  };

  var rptMod = {
    rx: /^data-repeat-([a-z]\w*)$/i,
    cb: function (mkey, value, e, ctx) {
      ctx.rpath = modelMod.cb(mkey, value, e, ctx);
      if (!ctx._elBody) ctx._elBody = _.removeParent(e);
      ctx._handleChildren = rptMod.cbChildren;
    },
    cbChildren: function (el, ctx, fnExec) {
      rptMod.cbChildLoop(el, ctx, fnExec);
    },
    cbChildLoop: function (el, ctx, fnExec, start, end) {
      var rk = ctx.rpath, key = curlyPat.expand(rk, ctx, 1),
        arr = curlyPat.eval(key, ctx),
        start = start || 0; end = end || arr.length;
      if (ctx.debug & 16) console.log('repeat', start, end, key);
      var frag = document.createDocumentFragment();
      for (var i = start; i < end; i++) {
        if (!(i in arr)) break;
        ctx[rk] = key + '.' + i;
        fnExec(ctx._elBody, ctx, frag);
      }
      ctx[rk] = key;
      _.append(frag, el);
    }
  };

  cls.defaultPatterns = [curlyPat];
  cls.defaultModules = [modelMod, tmplMod, rptMod];

  if (typeof val !== 'undefined' && module && module.exports) {
    Templar.webServer = require('./0ws');
    module.exports = Templar;
  }
})();