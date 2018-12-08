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
    if (domMon) {
      ist._domMon = new domMon();
      ist.recalc = function () { ist._domMon.recalc(_ctx, ist) };
      ist.monLog = function () { console.log(ist._domMon.watchList); };
    }

    ist.exec = function () { return _exec(_temp, _ctx, _par); }

    function _exec(e, ctx, par) {
      if (!(e = _.elCheck(e))) return;
      var e2 = e.cloneNode(true);
      _traverse(e2, ctx);
      if (ctx._removeParent) e2 = _.removeParent(e2);
      if (par = _.elCheck(par)) e2 = _.append(e2, par);
      return e2;
    }

    function _traverse(e, refctx) {
      if (refctx.debug & 1) console.log('node', _.nodePath(e));
      if (_.isComment(e)) return e;
      if ((e = _.elCheck(e)) === undefined) return;
      var ctx = _.oapply(new CTX(), refctx, e);

      if (_.isSingleTextChild(e)) {
        if (ctx.debug & 2) console.log('solo-text', e.nodeName, e.nodeValue);
        ist._patLoop(e, 'innerHTML', ctx, '');
        ctx._skipChildren = true;
      } else if (_.isNwText(e)) {
        if (ctx.debug & 2) console.log('text', e.nodeName, e.nodeValue);
        ist._patLoop(e, 'nodeValue', ctx, '', true);
      }

      if (e.attributes) for (var i = 0; i < e.attributes.length; i++) {
        var a = e.attributes[i];
        if (ctx.debug & 4) console.log('attr', a.name, a.value);
        ist._patLoop(a, 'value', ctx, a.name);
        _moduleLoop(a.name, a.value, e, ctx);
      }

      if (_.isfn(ctx._handleChildren)) ctx._handleChildren(e, ctx, _exec, ist);
      else { // default child functionality, if not overridden
        if (ctx._elBody) {
          e.innerHTML = '';
          e.appendChild(ctx._elBody);
        }
        if (!ctx._skipChildren) {
          var ce = e.firstChild;
          while (ce) {
            ce = _traverse(ce, ctx);
            if (ce) ce = ce.nextSibling;
          }
        }
      }

      _.rapply(refctx, ctx);
      return e;
    }

    ist._patLoop = function (robj, rkey, ctx, name, nomon) {
      if (!nomon && ist._domMon) ist._domMon.patStart({
        robj: robj, rkey: rkey, ctx: ctx, name: name, pattern: robj[rkey]
      });
      for (var i = 0; i < ist.patterns.length; i++) {
        var pat = ist.patterns[i];
        robj[rkey] = robj[rkey].replace(pat.rx,
          pat.cb.bind(ist, ctx, name));
      }
      if (ist._domMon) ist._domMon.patEnd();
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
        val = curlyPat.eval.bind(ist)(path, ctx);
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
        e.valueBindApplied = true;
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
      if (join === true) return curlyPat.join(path);
      return path;
    },
    eval: function (path, ctx) {
      if (_.isstr(path)) path = curlyPat.expand(path, ctx);
      var o = ctx, p = path.slice(), key, spath = curlyPat.join(path);
      while (key = p.shift()) {
        if (key in o) o = o[key];
        else if (domMon) o = domMon.arrayKey(o, key);
        if (typeof o === 'undefined') {
          console.warn('path not found', key, ' - ', spath);
          o = ''; break;
        }
      }
      if (ctx.debug & 8) console.log('eval', spath, o);
      if (this._domMon) this._domMon.patAdd(spath, o);
      return o;
    }
  };

  var domMon = function () {
    this.watchList = {};
    this.curpat = null;

    this.rptList = new DblMap();
  };
  { // domMon static props
    var dmProt = domMon.prototype;
    dmProt.patStart = function (obj) { this.curpat = obj; };
    dmProt.patEnd = function () {
      if (!this.curpat) return;
      this.curpat = null;
    };
    dmProt.patAdd = function (spath, value) {
      if (!this.curpat || spath.indexOf('model') !== 0
        || value instanceof Object) return;
      if (!(spath in this.watchList))
        this.watchList[spath] = { value: value, objs: [] };
      this.watchList[spath].objs.push(this.curpat);
    };
    dmProt.recalcPat = function (ctx, ist) {
      var objs = [];
      for (var key in this.watchList) {
        var watch = this.watchList[key], newval = curlyPat.eval(key, ctx);
        if (watch.value !== newval) {
          console.log('calc', watch.value === newval, key, watch.value, newval, watch.objs.length);
          for (var j = watch.objs.length - 1; j >= 0; j--) {
            var ref = watch.objs[j];
            if (!_.isAttached(ref.robj)) watch.objs.splice(j, 1);
            else if (objs.indexOf(ref) < 0) objs.push(ref);
          }
          watch.value = newval;
        }
        if (!watch.objs.length) delete this.watchList[key];
      }
      for (var i = 0; i < objs.length; i++) {
        var o = objs[i];
        o.robj[o.rkey] = o.pattern;
        ist._patLoop(o.robj, o.rkey, o.ctx, o.name, true);
      }
    };

    dmProt.rptStart = function (spath, el, info) {
      console.log('rptStart', spath, el, info);
      if (!this.rptList.has(spath, el))
        this.rptList.set(spath, el, { info: info, arr: [] });
    };
    dmProt.rptAdd = function (spath, el, item) {
      console.log('rptAdd', spath, el, item);
      var obj = this.rptList.get(spath, el);
      obj.arr.push(item);
    };
    dmProt.recalcRpt = function (ctx, ist) {
      this.rptList.forEach(function (obj, spath, el) {
        console.log('*****recalc RPT', spath, el, obj);
      });
    };

    dmProt.recalc = function (ctx, ist) {
      this.recalcPat(ctx, ist);
      this.recalcRpt(ctx, ist);
    };

    domMon.cleanKey = function (key) {
      if (key && _.isstr(key)) return key.replace(/\W+/g, '_');
      else return key;
    }
    domMon.arrayKey = function (obj, key) {
      if (!_.isarr(obj) || key.indexOf('=') < 0) return obj;
      var s = key.split('='), i = s[0], k = s[1], v = s[2] || '', o = obj;
      if (i === '' && v === '') return o;
      var c = domMon.cleanKey;
      if (i in o && (v === '' || (k in o[i] && c(o[i][k]) == c(v)))) return o[i];
      for (i = 0; i < o.length; i++) {
        if ((k in o[i] && o[i][k] === v)) return o[i];
      }
      return undefined;
    };
    domMon.arrayPath = function (path, arr, i, kv) {
      path = curlyPat.split(path);
      var key = path.pop(), weak = false;;
      if (!/^=/.test(key)) {
        path.push(key); key = i; weak = true;
      } else {
        var k = key.split('=')[1], o = arr[i];
        if (k === '' || !(k in o) || !o[k]) {
          key = i; weak = true;
        } else {
          var val = domMon.cleanKey(o[k]);
          if (kv) { kv.key = k; kv.value = val; }
          key = [i, k, val].join('=');
        }
      }
      path.push(key);
      var retval = curlyPat.join(path);
      if (weak) console.log('array weak key', retval);
      return retval;
    };
  }

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
    cbChildren: function (el, ctx, fnExec, ist) {
      rptMod.cbChildLoop(el, ctx, fnExec, ist);
    },
    cbChildLoop: function (el, ctx, fnExec, ist, start, end) {
      var rk = ctx.rpath, key = curlyPat.expand(rk, ctx, true),
        skey = curlyPat.join(key),
        arr = curlyPat.eval(key, ctx), ipath, kv;

      if (ist._domMon) ist._domMon.rptStart(skey, el, {
        ctx: ctx, fn: fnExec, ist: ist
      });
      if (!_.isarr(arr)) return;
      start = start || 0; end = end || arr.length;
      if (ctx.debug & 16) console.log('repeat', start, end, key);
      var frag = document.createDocumentFragment();
      for (var i = start; i < end; i++) {
        if (!(i in arr)) break;
        if (domMon) ipath = domMon.arrayPath(key, arr, i, kv = {});
        else ipath = key + '.' + i;
        ctx[rk] = ipath;
        var newel = fnExec(ctx._elBody, ctx, frag);
        if (ist._domMon) ist._domMon.rptAdd(skey, el, {
          key: kv.key, value: kv.value, ctx: ctx, el: newel
        });
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