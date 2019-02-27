/* global templarTools, DblMap */
'use strict';
// eslint-disable-next-line no-unused-vars
var Templar;
(function() {
  var _ = templarTools;
  /****************************************************************************/
  var cls = Templar = function(par, tmp, model, ctx) {
    var ist = this; var _par = _.elCheck(par); var _temp = _.elCheck(tmp)
      ; var odp = Object.defineProperty;
    function CTX() { };
    odp(CTX.prototype, 'model', { get: function() { return ist.model; } });
    odp(CTX.prototype, 'ist', { get: function() { return ist; } });
    odp(CTX.prototype, 'ops', { get: function() { return ist.ops; } });
    ist.model = model;
    ist.ops = _.oapply({}, pat.ops);
    var _ctx = _.oapply(new CTX(), ctx);

    ist.patterns = cls.defaultPatterns;
    ist.modules = cls.defaultModules;
    if (DomMon) {
      ist._domMon = new DomMon();
      ist.recalc = function() { ist._domMon.recalc(); };
      // ist.monLog = function () {
      //   console.log('watchlist', ist._domMon.watchList);
      //   console.log('rptList', ist._domMon.rptList);
      // };
    }

    ist.exec = function() { return ist._exec(_temp, _ctx, _par); };

    ist._exec = function(e, ctx, par) {
      if (!(e = _.elCheck(e))) return;
      var e2 = e.cloneNode(true);
      _traverse(e2, ctx);
      if (ctx._removeParent) e2 = _.removeParent(e2);
      // eslint-disable-next-line no-cond-assign
      if (par = _.elCheck(par)) e2 = _.append(e2, par);
      return e2;
    };

    function _traverse(e, refctx) {
      // if (refctx.debug & 1) console.log('node', _.nodePath(e));
      if (_.isComment(e)) return e;
      if ((e = _.elCheck(e)) === void 0) return;
      var ctx = _.oapply(new CTX(), refctx, e);

      if (_.isSingleTextChild(e)) {
        // if (ctx.debug & 2) console.log('solo-text', e.nodeName, e.nodeValue);
        var contentType = _.elHasAttribute(e, 'as-html')
          ? 'innerHTML' : 'textContent';
        ist._patLoop(e, contentType, ctx, '');
        ctx._skipChildren = true;
      } else if (_.isNwText(e)) {
        // if (ctx.debug & 2) console.log('text', e.nodeName, e.nodeValue);
        ist._patLoop(e, 'nodeValue', ctx, '', true);
      }

      if (e.attributes) {
        e.attributes.forEach(function(a, i) {
          // if (ctx.debug & 4) console.log('attr', a.name, a.value);
          ist._patLoop(a, 'value', ctx, a.name);
          _moduleLoop(a.name, a.value, e, ctx);
          if (a.name === 'value' && e.nodeName === 'SELECT') {
            e.value = a.value;
          } if (a.name === 'checked' && a.value === 'false') {
            e[a.name] = false;
          }
        });
      }

      if (_.isfn(ctx._handleChildren)) ctx._handleChildren(e, ctx);
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

    ist._patLoop = function(robj, rkey, ctx, name, nomon) {
      var pattern = robj[rkey];
      var value = ist._patVal(pattern, ctx, name);
      robj[rkey] = value;
      if (pattern === value || ctx._ignorePat) {
        delete ctx._ignorePat; return;
      } if (!nomon && ist._domMon) {
        ist._domMon.patAdd({
          robj: robj, rkey: rkey, ctx: ctx, name: name,
          pattern: pattern, value: value
        });
      }
    };
    ist._patVal = function(value, ctx, name) {
      ist.patterns.forEach(function(pat, i) {
        value = value.replace(pat.rx,
          pat.cb.bind(ist, ctx, name));
      });
      return value;
    };

    function _moduleLoop(key, value, e, ctx) {
      ist.modules.forEach(function(mod, i) {
        var mkey = key.match(mod.rx);
        if (mkey && _.isfn(mod.cb)) mod.cb(mkey, value, e, ctx);
      });
    }
  };

  /****************************************************************************/
  // pattern/module functions
  var pat = {
    rx: /{{\s*(.+?)\s*}}/ig,
    cb: function(ctx, name, all, spath) {
      var path = pat.expand(spath, ctx);
      var val = pat.eval(ctx, path);
      val = pat.event(path, val, ctx, name);
      if (val === null) val = all;
      if (val instanceof Date) val = val.toString();
      if (_.isobj(val) || _.isfn(val)) val = '';
      return val;
    },
    eventRx: /^on-?/i,
    event: function(path, val, ctx, name) {
      var fn = val; var e = ctx._node; var ename = '';
      if (_.isfn(val) && pat.eventRx.test(name)) {
        ename = name.replace(pat.eventRx, '');
        val = ''; ctx._ignorePat = true;
        e.attributes.removeNamedItem(name); delete e[name];
      } else if (name === 'value' && !e.valueBindApplied
        && _.elHasAttribute(e, 'value-bind')) {
        ename = 'change';
        e.valueBindApplied = true;
        fn = pat.cbAutoChange;
      }
      if (ename) {
        // if (ctx.debug & 8) console.log('bind', ename, e.nodeName);
        e.addEventListener(ename, fn.bind(e, ctx, path,
          pat.eval.bind(null, ctx)));
      }
      return val;
    },
    cbAutoChange: function(ctx, path) {
      // var stack = [];
      pat.eval(ctx, path, this.value); //, stack);
      // console.log('change-value-bind', this.value, path, stack[0].o);
    },

    rxPat: /[.[\]]+/g,
    split: function(path) {
      if (_.isarr(path)) return path;
      else if (_.isstr(path)) return path.split(pat.rxPat);
      else return [];
    },
    join: function(path) {
      if (_.isarr(path)) return path.join('.');
      else if (_.isstr(path)) return path;
      else return '';
    },
    expand: function(spath, ctx, join) {
      var path = pat.split(spath);
      var p0 = path.shift(); var o0 = ctx[p0];
      if (p0 !== 'model' && _.isstr(o0) && o0.indexOf('model') === 0) {
        path = pat.split(o0).concat(path);
      } else path.unshift(p0);
      if (join === true) return pat.join(path);
      return path;
    },
    eval: function(ctx, path, setValue, stack) {
      if (_.isstr(path)) path = pat.expand(path, ctx);
      var o = ctx; var p = path.slice(); var key; var spath = pat.join(path)
        ; var kv; var retKV = stack === true;
      if (!_.isarr(stack)) stack = [];
      // eslint-disable-next-line no-cond-assign
      while (key = p.shift()) {
        kv = pat.checkKey(o, key, ctx, p); stack.unshift(kv);
        if (o === void 0 && !kv.fn && !kv.addr && !kv.skip) {
          // console.warn('path not found', key, ' - ', spath, kv);
          o = ''; break;
        }
        o = pat.kvSet(o, kv, ctx, key, p, spath);
      }
      if (retKV) return kv;
      if (!_.isnull(setValue) && kv && _.isobj(kv.o)) {
        o = kv.o[kv.key] = setValue;
      }
      // if (ctx.debug & 8) console.log('eval', spath, o);
      return o;
    },
    kvSet: function(o, kv, ctx, key, p, spath) {
      if (kv.fn) o = kv.fn(o, p, ctx, key, spath, pat.eval.bind(null, ctx));
      else if (kv.addr) o = kv.key;
      else if (kv.skip);// o = o;
      else if (kv.in) o = o[kv.key];
      else o = void 0;
      return o;
    },
    checkKey: function(o, key, ctx, p) {
      var retval = { o: o, key: key, in: false };
      if (_.in(key, o)) retval = { o: o, key: key, in: true };
      else if (_.in(key, ctx.ops)) retval = { o: o, fn: ctx.ops[key] };
      else if (DomMon && DomMon.isStrongKey(o, key)) {
        retval = DomMon.arrayIndex(o, key) || retval;
      } else retval = pat.isPtr(o, key, ctx, p) || retval;
      return retval;
    },
    isPtr: function(o, key, ctx, pr) {
      if ('@*'.indexOf(key[0]) < 0) return;
      var addr = key[0] === '@'; var tmp;
      key = key.substr(1);
      if (key[0] === '*') key = key.substr(1);
      else if (addr && (!pr || pr.length === 0) && _.in(key, o)) {
        return { o: o, key: key, in: true, addr: addr };
      }
      function tryKey(k) {
        if (_.in(k, ctx) && _.in(ctx[k], o)) {
          return { o: o, key: ctx[k], in: true, addr: addr };
        } else if (_.in(k, ctx) && _.isfn(ctx[k])) return { o: o, fn: ctx[k] };
      }
      if ((tmp = tryKey(key)) !== void 0) return tmp;
      if ((tmp = tryKey('_' + key)) !== void 0) return tmp;
    },
    ops: {
      // eslint-disable-next-line eqeqeq
      '==': function(o, p) { return o && o.toString() == p.shift(); },
      '>': function(o, p) { return o && o.toString() > p.shift(); },
      '<': function(o, p) { return o && o.toString() < p.shift(); },
      '?': function(o, p) {
        var ie = p.shift().split(':'); return o ? ie[0] : ie[1];
      }, 'setc': function(o, p, ctx) {
        var kv = pat.checkKey(o, p.shift(), ctx, p); var val = p.shift();
        if (/\d+/.test(val)) val = parseInt(val);
        if (_.isobj(o)) {
          return function() {
            o[kv.key] = val;
            ctx.ist.recalc();
          };
        }
      }
    }
  };

  var funcPat = {
    rx: /{([?:]){\s*((?:\n|.)+?)\s*}}/ig,
    cb: function(ctx, name, all, type, fnbody) {
      var e = ctx._node;
      fnbody = type === ':' ? 'return ' + fnbody : fnbody;
      // eslint-disable-next-line no-new-func
      var fn = (new Function('ctx, qq, event', fnbody))
        .bind(e, ctx, pat.eval.bind(null, ctx));
      if (/^on-?/i.test(name)) {
        e.addEventListener(name.replace(/^on-?/i, ''), fn);
        e.attributes.removeNamedItem(name); delete e[name];
        return '';
      } else return fn();
    }
  };

  var DomMon = function() {
    this.watchList = [];
    this.rptList = new DblMap();
  };
  // eslint-disable-next-line no-lone-blocks
  { // domMon static props
    var dmProt = DomMon.prototype;
    var lastRC = 0; var pendRC = false;
    dmProt.recalc = function() {
      if (!lastRC) {
        // console.log('recalc start');
        var dt0 = Date.now();
        var that = this;
        that.recalcRpt();
        that.recalcPat();
        pendRC = false;
        lastRC++;
        _.last(function() {
          console.log('recalc end', Date.now() - dt0);
          var cb = that.recalc.bind(that);
          setTimeout(function() { lastRC = 0; if (pendRC) cb(); }, 200);
        });
      } else pendRC = true;
    };

    dmProt.patAdd = function(obj) { this.watchList.push(obj); };
    dmProt.recalcPat = function() {
      var wl = this.watchList;
      wl.forEachRev(function(oi, i) {
        if (!_.isAttached(oi.robj)) { wl.splice(i, 1); return; }
        var newval = oi.ctx.ist._patVal(oi.pattern, oi.ctx, oi.name);
        if (oi.value === newval) return;
        oi.robj[oi.rkey] = oi.value = newval;
      });
    };

    dmProt.rptStart = function(spath, el, ctx, key) {
      spath = DomMon.cleanPath(spath);
      // if (ctx.debug & 32) console.log('rptStart', spath, el, ctx);
      if (!this.rptList.has(spath, el)) {
        this.rptList.set(spath, el, {
          ctx: ctx, key: key, arr: []
        });
      }
    };
    dmProt.rptAdd = function(spath, el, item, i) {
      spath = DomMon.cleanPath(spath);
      // if (ctx.debug & 32) console.log('rptAdd', spath, el, item);
      var obj = this.rptList.get(spath, el);
      if (typeof i === 'number' && i >= 0 && i < obj.arr.length) {
        obj.arr.splice(i, 0, item);
      } else obj.arr.push(item);
    };
    dmProt.recalcRpt = function() {
      this.rptList.forEach(function(obj, spath, el) {
        _.then(function() {
          var arr = pat.eval(obj.ctx, spath);
          if (_.isarr(arr)) {
            DomMon.arrayRemove(arr, obj.arr, obj.key, 'value');
            DomMon.arrayAdd(arr, obj.arr, obj.key, 'value', obj.ctx, el);
            DomMon.arrayOrder(arr, obj.arr, obj.key, 'value', el);
          }
        });
      });
    };
    DomMon.arrayRemove = function(na, oa, nk, ok) {
      var nl = na.length; var cnt = 0;
      if (!nk) {
        while (oa.length > nl) {
          var obj = oa.pop();
          _.elRemove(obj.el);
          cnt++;
        }
      } else {
        var nak = DomMon.map(na, nk, true);
        oa.forEachRev(function(oai, i) {
          if (!_.in(oai[ok], nak)) { // if not in new keys, remove
            var obj = oa.splice(i, 1)[0];
            _.elRemove(obj.el);
            cnt++;
          }
        });
      }
      return cnt;
    };
    DomMon.arrayAdd = function(na, oa, nk, ok, ctx, el) {
      if (!rptMod) return;
      var nl = na.length; var cnt = 0;
      if (!nk) {
        for (var i = oa.length; i < nl; i++) {
          _.then(function(i) {
            rptMod.cbChildItem(na, i, ctx, el);
            _.append(ctx._rfrag, el);
          }, [i]);
          cnt++;
          if (cnt > 5000) break;
        }
      } else {
        var oak = DomMon.map(oa, ok, true);
        var nak = DomMon.map(na, nk);
        for (i = 0; i < na.length; i++) {
          if (!_.in(nak[i], oak)) { // if not in old keys, add
            _.then(function(i) {
              var insert = _.in(i, oa);
              rptMod.cbChildItem(na, i, ctx, el);
              if (insert) _.before(ctx._rfrag, oa[i + 1].el);
              else _.append(ctx._rfrag, el);
            }, [i]);
            cnt++;
          }
        }
      }
      return cnt;
    };
    DomMon.arrayOrder = function(na, oa, nk, ok, el) {
      var c = DomMon.cleanKey; var m = DomMon.map;
      if (!nk || na.length === 0) return;
      var nak = m(na, nk, true);
      var opre = m(oa, ok).join(' ');
      oa.sort(function(a, b) { return nak[c(a[ok])] - nak[c(b[ok])]; });
      var opost = m(oa, ok).join(' ');
      if (opre !== opost) {
        // if (ctx.debug & 32) console.log('reorder', opre, '-->', opost);
        var frag = _.removeParent(el);
        oa.forEach(function(oai) { _.append(oai.el, frag); });
        _.append(frag, el);
      }
    };

    DomMon.map = function(arr, key, makeObject) {
      var retval = makeObject ? {} : [];
      for (var i = 0; i < arr.length; i++) {
        var ck = DomMon.cleanKey(arr[i][key]);
        if (makeObject && ck) retval[ck] = i;
        else if (!makeObject) retval.push(ck || i);
      }
      return retval;
    };

    var cleanKeyCache = {}; var rxW = /\W/; var rxWp = /\W+/g;
    DomMon.cleanKey = function(key) {
      if (key && _.isstr(key) && rxW.test(key)) {
        if (cleanKeyCache.hasOwnProperty(key)) return cleanKeyCache[key];
        var newKey = cleanKeyCache[key] = key.replace(rxWp, '_');
        return newKey;
      } else return key;
    };
    DomMon.cleanPath = function(spath) {
      return spath.replace(/\.\d+=/g, '.=');
    };
    DomMon.isStrongKey = function(obj, key) {
      return (_.isarr(obj) || _.isnull(obj)) && /=/.test(key) && key !== '==';
    };
    DomMon.arrayIndex = function(obj, key) {
      var c = DomMon.cleanKey;
      var s = key.split('='); var i = s[0]; var k = s[1];
      var v = c(s[2]) || ''; var o = obj;
      if (i === '' && v === '') return { o: o, skip: true };
      // eslint-disable-next-line eqeqeq
      if (_.in(i, o) && (v === '' || (_.in(k, o[i]) && c(o[i][k]) == v))) {
        return { o: o, key: i, in: true };
      }
      for (i = 0; i < o.length; i++) {
        var oi = o[i];
        // eslint-disable-next-line eqeqeq
        if (_.in(k, oi) && c(oi[k]) == v) return { o: o, key: i, in: true };
      }
    };
    DomMon.arrayPath = function(path, arr, i, kv) {
      kv = kv || {}; arr = arr || [];
      path = pat.split(path);
      var key = path.pop();
      if (!/^\d*=/.test(key)) {
        path.push(key); key = i;
      } else {
        var k = kv.key = key.split('=')[1]; var o = arr[i] || {};
        if (k === '' || !_.in(k, o) || !o[k]) {
          key = i;
        } else {
          var val = kv.value = DomMon.cleanKey(o[k]);
          key = [i, k, val].join('=');
        }
      }
      path.push(key);
      var retval = pat.join(path);
      // if (weak && ctx.debug & 32) console.log('array weak key', retval);
      return retval;
    };
  }

  var modelMod = {
    rx: _.rxAtt(/model-([a-z]\w*)$/i),
    cb: function(mkey, value, e, ctx) {
      var key = mkey[1];
      value = value || ctx.lastModel || 'model';
      var path = pat.expand(value, ctx, true);
      ctx[key] = path;
      ctx.lastModel = key;
      return key;
    }
  };

  var tmplMod = {
    rx: _.rxAtt(/(?:template|tmp)$/i),
    cb: function(mkey, value, e, ctx) {
      var elBody;
      if (_.in(value, ctx.ist.tmplCache)) {
        elBody = ctx.ist.tmplCache[value].cloneNode(true);
        // eslint-disable-next-line no-cond-assign
      } else if (elBody = _.elCheck(value)) {
        elBody = _.checkEnds(elBody.cloneNode(true));
        if (!_.isobj(ctx.ist.tmplCache)) ctx.ist.tmplCache = {};
        ctx.ist.tmplCache[value] = elBody.cloneNode(true);
      }
      if (elBody) ctx._elBody = elBody;
      else console.warn('template', value, 'not found');
    }
  };

  var setMod = {
    rx: _.rxAtt(/setc(u)?-([a-z]\w*)$/i),
    cb: function(mkey, value, e, ctx) {
      var u = mkey[1] === 'u' ? '_' : '';
      ctx[u + mkey[2]] = value;
    }
  };

  function dragGoAfter(ev) {
    var rect = ev.target.getBoundingClientRect();
    return (rect.height / 2) < ev.offsetY;
  }

  var dragMod = {
    rx: _.rxAtt(/(drag|drop)(i)?(?:-([a-z]\w*))?$/i),
    cb: function(mkey, value, e, ctx) {
      var op = mkey[1]; var hasIdx = !!mkey[2]; var scope = mkey[3];
      var apath = pat.expand(value || ctx.lastModel, ctx);
      value = pat.join(apath);
      if (op === 'drag') {
        e.draggable = true;
        e.ondragstart = function(ev) {
          var tsrc = [scope, value].join('\0');
          ev.dataTransfer.setData('text', tsrc);
        };
      } else {
        e.ondragover = function(ev) { ev.preventDefault(); };
        e.ondrop = function(ev) {
          var txt = ev.dataTransfer.getData('text'); var data = txt.split('\0');
          if (scope && scope !== data[0]) return;
          ev.stopPropagation();
          var tkv = pat.eval(ctx, apath, null, hasIdx);
          var tIdx = tkv.key; var tArr = hasIdx ? tkv.o : tkv;
          var skv = pat.eval(ctx, data[1], null, true);
          var sIdx = skv.key; var sArr = skv.o;
          var sObj = sArr.splice(sIdx, 1)[0];
          var after = dragGoAfter(ev); var fn = after ? 'push' : 'unshift';
          if (after && !_.isnull(tIdx)) tIdx++;
          if (sArr === tArr && sIdx < tIdx - 1) tIdx--;
          // eslint-disable-next-line max-len
          // if (ctx.debug & 64) console.log('drop', data[1], '->', value, hasIdx, sIdx, '->', tIdx, fn);
          if (_.isnull(tIdx)) tArr[fn](sObj);
          else tArr.splice(tIdx, 0, sObj);
          ctx.ist.recalc();
        };
      }
    }
  };

  var rptMod = {
    rx: _.rxAtt(/repeat-([a-z]\w*)$/i),
    cb: function(mkey, value, e, ctx) {
      ctx._rpath = modelMod.cb(mkey, value, e, ctx);
      ctx._rkey = pat.expand(ctx._rpath, ctx, true);
      ctx._rskey = pat.join(ctx._rkey);
      ctx._rfrag = document.createDocumentFragment();
      if (!ctx._elBody) ctx._elBody = _.removeParent(e);
      ctx._handleChildren = rptMod.cbChildren;
    },
    cbChildren: function(el, ctx) {
      rptMod.cbChildLoop(el, ctx);
    },
    cbChildLoop: function(el, ctx, start, end) {
      var arr = pat.eval(ctx, ctx._rkey); var ist = ctx.ist; var kv = {};
      if (DomMon) DomMon.arrayPath(ctx._rkey, [], '', kv);
      if (ist._domMon) ist._domMon.rptStart(ctx._rskey, el, ctx, kv.key);
      if (!_.isarr(arr)) return;
      start = start || 0; end = end || arr.length;
      // if (ctx.debug & 16) console.log('repeat', start, end, ctx._rkey);
      for (var i = start; i < end; i++) {
        _.then(rptMod.cbChildItem, [arr, i, ctx, el]);
      }
      _.then(_.append, [ctx._rfrag, el]);
    },
    cbChildItem: function(arr, i, ctx, el) {
      var ist = ctx.ist; var ipath; var kv;
      if (!_.in(i, arr)) return null;
      if (DomMon) ipath = DomMon.arrayPath(ctx._rkey, arr, i, kv = {});
      else ipath = ctx._rkey + '.' + i;
      ctx[ctx._rpath] = ipath;
      var newel = ist._exec(ctx._elBody, ctx, ctx._rfrag);
      ctx[ctx._rpath] = ctx._rkey;
      if (ist._domMon) {
        ist._domMon.rptAdd(ctx._rskey, el, {
          key: kv.key, value: kv.value, ctx: ctx, el: newel
        }, i);
      }
      return newel;
    }
  };

  cls.defaultPatterns = [pat, funcPat];
  cls.defaultModules = [modelMod, tmplMod, setMod, dragMod, rptMod];
})();
