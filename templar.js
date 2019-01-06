'use strict';
var Templar;
(function () {
  var _ = templarTools;
  /****************************************************************************/
  var cls = Templar = function (par, tmp, model, ctx) {
    var ist = this, _par = _.elCheck(par), _temp = _.elCheck(tmp)
      , odp = Object.defineProperty;
    function CTX() { };
    odp(CTX.prototype, "model", { get: function () { return ist.model; } });
    odp(CTX.prototype, "ist", { get: function () { return ist; } });
    odp(CTX.prototype, "ops", { get: function () { return ist.ops; } });
    ist.model = model;
    ist.ops = _.oapply({}, pat.ops);
    var _ctx = _.oapply(new CTX(), ctx);

    ist.patterns = cls.defaultPatterns;
    ist.modules = cls.defaultModules;
    if (domMon) {
      ist._domMon = new domMon();
      ist.recalc = function () { ist._domMon.recalc() };
      // ist.monLog = function () {
      //   console.log('watchlist', ist._domMon.watchList);
      //   console.log('rptList', ist._domMon.rptList);
      // };
    }

    ist.exec = function () { return ist._exec(_temp, _ctx, _par); }

    ist._exec = function (e, ctx, par) {
      if (!(e = _.elCheck(e))) return;
      var e2 = e.cloneNode(true);
      _traverse(e2, ctx);
      if (ctx._removeParent) e2 = _.removeParent(e2);
      if (par = _.elCheck(par)) e2 = _.append(e2, par);
      return e2;
    }

    function _traverse(e, refctx) {
      // if (refctx.debug & 1) console.log('node', _.nodePath(e));
      if (_.isComment(e)) return e;
      if ((e = _.elCheck(e)) === void 0) return;
      var ctx = _.oapply(new CTX(), refctx, e);

      if (_.isSingleTextChild(e)) {
        // if (ctx.debug & 2) console.log('solo-text', e.nodeName, e.nodeValue);
        var contentType = _.elHasAttribute(e, 'as-html') ? 'innerHTML' : 'textContent';
        ist._patLoop(e, contentType, ctx, '');
        ctx._skipChildren = true;
      } else if (_.isNwText(e)) {
        // if (ctx.debug & 2) console.log('text', e.nodeName, e.nodeValue);
        ist._patLoop(e, 'nodeValue', ctx, '', true);
      }

      if (e.attributes) for (var i = e.attributes.length - 1; i >= 0; i--) {
        var a = e.attributes[i];
        // if (ctx.debug & 4) console.log('attr', a.name, a.value);
        ist._patLoop(a, 'value', ctx, a.name);
        _moduleLoop(a.name, a.value, e, ctx);
        if (a.name === 'value' && e.nodeName == 'SELECT') { e.value = a.value; }
        if (a.name === 'checked' && a.value == 'false') { e[a.name] = false; }
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

    ist._patLoop = function (robj, rkey, ctx, name, nomon) {
      var pattern = robj[rkey],
        value = ist._patVal(pattern, ctx, name);
      robj[rkey] = value;
      if (pattern === value || ctx._ignorePat) { delete ctx._ignorePat; return; }
      if (!nomon && ist._domMon) ist._domMon.patAdd({
        robj: robj, rkey: rkey, ctx: ctx, name: name,
        pattern: pattern, value: value
      });
    }
    ist._patVal = function (value, ctx, name) {
      for (var i = 0; i < ist.patterns.length; i++) {
        var pat = ist.patterns[i];
        value = value.replace(pat.rx,
          pat.cb.bind(ist, ctx, name));
      }
      return value;
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
  var pat = {
    rx: /{{\s*(.+?)\s*}}/ig,
    cb: function (ctx, name, all, spath) {
      var path = pat.expand(spath, ctx),
        val = pat.eval(ctx, path);
      val = pat.event(path, val, ctx, name);
      if (val === null) val = all;
      if (val instanceof Date) val = val.toString();
      if (_.isobj(val) || _.isfn(val)) val = '';
      return val;
    },
    eventRx: /^on-?/i,
    event: function (path, val, ctx, name) {
      var fn = val, e = ctx._node, ename = '';
      if (_.isfn(val) && pat.eventRx.test(name)) {
        ename = name.replace(pat.eventRx, '');
        val = ''; ctx._ignorePat = true;
        e.attributes.removeNamedItem(name); delete e[name];
      } else if (name === 'value' && !e.valueBindApplied && _.elHasAttribute(e, 'value-bind')) {
        ename = 'change'
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
    cbAutoChange: function (ctx, path) {
      //var stack = [];
      pat.eval(ctx, path, this.value); //, stack);
      //console.log('change-value-bind', this.value, path, stack[0].o);
    },

    rxPat: /[.\[\]]+/g,
    split: function (path) {
      if (_.isarr(path)) return path;
      else if (_.isstr(path)) return path.split(pat.rxPat);
      else return [];
    },
    join: function (path) {
      if (_.isarr(path)) return path.join('.');
      else if (_.isstr(path)) return path;
      else return '';
    },
    expand: function (spath, ctx, join) {
      var path = pat.split(spath);
      var p0 = path.shift(), o0 = ctx[p0];
      if (p0 !== 'model' && _.isstr(o0) && o0.indexOf('model') === 0)
        path = pat.split(o0).concat(path);
      else path.unshift(p0);
      if (join === true) return pat.join(path);
      return path;
    },
    eval: function (ctx, path, setValue, stack) {
      if (_.isstr(path)) path = pat.expand(path, ctx);
      var o = ctx, p = path.slice(), key, spath = pat.join(path)
        , kv, retKV = stack === true;
      if (!_.isarr(stack)) stack = [];
      while (key = p.shift()) {
        kv = pat.checkKey(o, key, ctx, p); stack.unshift(kv);
        if (o === void 0 && !kv.fn && !kv.addr && !kv.skip) {
          //console.warn('path not found', key, ' - ', spath, kv);
          o = ''; break;
        }
        o = pat.kvSet(o, kv, ctx, key, p, spath);
      }
      if (retKV) return kv;
      if (!_.isnull(setValue) && kv && _.isobj(kv.o)) o = kv.o[kv.key] = setValue;
      // if (ctx.debug & 8) console.log('eval', spath, o);
      return o;
    },
    kvSet: function (o, kv, ctx, key, p, spath) {
      if (kv.fn) o = kv.fn(o, p, ctx, key, spath, pat.eval.bind(null, ctx));
      else if (kv.addr) o = kv.key;
      else if (kv.skip) o = o;
      else if (kv.in) o = o[kv.key];
      else o = void 0;
      return o;
    },
    checkKey: function (o, key, ctx, p) {
      var retval = { o: o, key: key, in: false };
      if (_.in(key, o)) retval = { o: o, key: key, in: true };
      else if (_.in(key, ctx.ops)) retval = { o: o, fn: ctx.ops[key] };
      else if (domMon && domMon.isStrongKey(o, key))
        retval = domMon.arrayIndex(o, key) || retval;
      else retval = pat.isPtr(o, key, ctx, p) || retval;
      return retval;
    },
    isPtr: function (o, key, ctx, pr) {
      if ('@*'.indexOf(key[0]) < 0) return;
      var addr = key[0] === '@', tmp;
      key = key.substr(1);
      if (key[0] === '*') key = key.substr(1);
      else if (addr && (!pr || pr.length === 0) && _.in(key, o))
        return { o: o, key: key, in: true, addr: addr };
      function tryKey(k) {
        if (_.in(k, ctx) && _.in(ctx[k], o))
          return { o: o, key: ctx[k], in: true, addr: addr };
        else if (_.in(k, ctx) && _.isfn(ctx[k])) return { o: o, fn: ctx[k] };
      }
      if ((tmp = tryKey(key)) !== void 0) return tmp;
      if ((tmp = tryKey('_' + key)) !== void 0) return tmp;
      return;
    },
    ops: {
      '==': function (o, p) { return o && o.toString() == p.shift(); },
      '>': function (o, p) { return o && o.toString() > p.shift(); },
      '<': function (o, p) { return o && o.toString() < p.shift(); },
      '?': function (o, p) { var ie = p.shift().split(':'); return o ? ie[0] : ie[1]; },
      'setc': function (o, p, ctx) {
        var kv = pat.checkKey(o, p.shift(), ctx, p), val = p.shift();
        if (/\d+/.test(val)) val = parseInt(val);
        if (_.isobj(o)) return function () {
          o[kv.key] = val;
          ctx.ist.recalc();
        }
      }
    }
  };

  var funcPat = {
    rx: /{([?:]){\s*((?:\n|.)+?)\s*}}/ig,
    cb: function (ctx, name, all, type, fnbody) {
      var ist = this, e = ctx._node
        , fnbody = type === ':' ? 'return ' + fnbody : fnbody
        , fn = (new Function('ctx, qq, event', fnbody))
          .bind(e, ctx, pat.eval.bind(null, ctx));
      if (/^on-?/i.test(name)) {
        e.addEventListener(name.replace(/^on-?/i, ''), fn);
        e.attributes.removeNamedItem(name); delete e[name];
        return '';
      } else return fn();
    }
  };

  var domMon = function () {
    this.watchList = [];
    this.rptList = new DblMap();
  };
  { // domMon static props
    var dmProt = domMon.prototype;
    var lastRC = 0, pendRC = false;
    dmProt.recalc = function () {
      if (!lastRC) {
        this.recalcRpt();
        this.recalcPat();
        pendRC = false;
        lastRC++;
        var cb = this.recalc.bind(this);
        setTimeout(function () { lastRC = 0; if (pendRC) cb(); }, 200);
      } else pendRC = true;
    };

    dmProt.patAdd = function (obj) { this.watchList.push(obj); };
    dmProt.recalcPat = function () {
      var wl = this.watchList;
      for (var i = wl.length - 1; i >= 0; i--) {
        var oi = wl[i];
        if (!_.isAttached(oi.robj)) { wl.splice(i, 1); continue; }
        var newval = oi.ctx.ist._patVal(oi.pattern, oi.ctx, oi.name);
        if (oi.value === newval) continue;
        oi.robj[oi.rkey] = oi.value = newval;
      }
    };

    dmProt.rptStart = function (spath, el, ctx, key) {
      spath = domMon.cleanPath(spath);
      // if (ctx.debug & 32) console.log('rptStart', spath, el, ctx);
      if (!this.rptList.has(spath, el))
        this.rptList.set(spath, el, {
          ctx: ctx, key: key, arr: []
        });
    };
    dmProt.rptAdd = function (spath, el, item, i) {
      spath = domMon.cleanPath(spath);
      // if (ctx.debug & 32) console.log('rptAdd', spath, el, item);
      var obj = this.rptList.get(spath, el);
      if (typeof i === 'number' && i >= 0 && i < obj.arr.length)
        obj.arr.splice(i, 0, item);
      else obj.arr.push(item);
    };
    dmProt.recalcRpt = function () {
      this.rptList.forEach(function (obj, spath, el) {
        var arr = pat.eval(obj.ctx, spath);
        if (_.isarr(arr)) {
          domMon.arrayRemove(arr, obj.arr, obj.key, 'value');
          domMon.arrayAdd(arr, obj.arr, obj.key, 'value', obj.ctx, el);
          domMon.arrayOrder(arr, obj.arr, obj.key, 'value', el);
        }
      });
    };
    domMon.arrayRemove = function (na, oa, nk, ok) {
      var nl = na.length, cnt = 0;
      if (!nk) while (oa.length > nl) {
        var obj = oa.pop();
        _.elRemove(obj.el);
        cnt++;
      } else {
        var nak = domMon.map(na, nk, true);
        for (var i = oa.length - 1; i >= 0; i--) { //reverse order, removals
          if (!_.in(oa[i][ok], nak)) { // if not in new keys, remove
            var obj = oa.splice(i, 1)[0];
            _.elRemove(obj.el);
            cnt++;
          }
        }
      }
      return cnt;
    };
    domMon.arrayAdd = function (na, oa, nk, ok, ctx, el) {
      if (!rptMod) return;
      var nl = na.length, cnt = 0;
      if (!nk) while (oa.length < nl) {
        rptMod.cbChildItem(na, oa.length, ctx, el);
        _.append(ctx._rfrag, el);
        cnt++;
        if (cnt > 5000) break;
      } else {
        var oak = domMon.map(oa, ok, true);
        var nak = domMon.map(na, nk);
        for (var i = 0; i < na.length; i++) {
          if (!_.in(nak[i], oak)) { // if not in old keys, add
            var insert = _.in(i, oa);
            rptMod.cbChildItem(na, i, ctx, el);
            if (insert) _.before(ctx._rfrag, oa[i + 1].el);
            else _.append(ctx._rfrag, el);
            cnt++;
          }
        }
      }
      return cnt;
    };
    domMon.arrayOrder = function (na, oa, nk, ok, el) {
      var c = domMon.cleanKey, m = domMon.map, off = 0, offr = {};
      if (!nk || na.length === 0) return;
      var nak = m(na, nk, true);
      var opre = m(oa, ok).join(' ');
      oa.sort(function (a, b) { return nak[c(a[ok])] - nak[c(b[ok])]; });
      var opost = m(oa, ok).join(' ');
      if (opre !== opost) {
        // if (ctx.debug & 32) console.log('reorder', opre, '-->', opost);
        var frag = _.removeParent(el);
        for (var i = 0; i < oa.length; i++) { _.append(oa[i].el, frag) };
        _.append(frag, el);
      }
    };

    domMon.map = function (arr, key, makeObject) {
      var retval = makeObject ? {} : [];
      for (var i = 0; i < arr.length; i++) {
        var ck = domMon.cleanKey(arr[i][key]);
        if (makeObject && ck) retval[ck] = i;
        else if (!makeObject) retval.push(ck || i);
      }
      return retval;
    };

    domMon.cleanKey = function (key) {
      if (key && _.isstr(key)) return key.replace(/\W+/g, '_');
      else return key;
    };
    domMon.cleanPath = function (spath) {
      return spath.replace(/\.\d+=/g, '.=');
    };
    domMon.isStrongKey = function (obj, key) {
      return (_.isarr(obj) || _.isnull(obj)) && /=/.test(key) && key !== '==';
    };
    domMon.arrayIndex = function (obj, key) {
      var s = key.split('='), i = s[0], k = s[1], v = s[2] || '', o = obj;
      if (i === '' && v === '') return { o: o, skip: true };
      var c = domMon.cleanKey;
      if (_.in(i, o) && (v === '' || (_.in(k, o[i]) && c(o[i][k]) == c(v))))
        return { o: o, key: i, in: true };
      for (i = 0; i < o.length; i++) {
        if (_.in(k, o[i]) && o[i][k] == v) return { o: o, key: i, in: true };
      }
      return;
    };
    domMon.arrayPath = function (path, arr, i, kv) {
      kv = kv || {}; arr = arr || [];
      path = pat.split(path);
      var key = path.pop(), weak = false;;
      if (!/^\d*=/.test(key)) {
        path.push(key); key = i; weak = true;
      } else {
        var k = kv.key = key.split('=')[1], o = arr[i] || {};
        if (k === '' || !_.in(k, o) || !o[k]) {
          key = i; weak = true;
        } else {
          var val = kv.value = domMon.cleanKey(o[k]);
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
    cb: function (mkey, value, e, ctx) {
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
    cb: function (mkey, value, e, ctx) {
      var elBody;
      if (_.in(value, ctx.ist.tmplCache)) {
        elBody = ctx.ist.tmplCache[value];
      } else {
        elBody = _.elCheck(value);
        elBody = _.checkEnds(elBody.cloneNode(true));
        if (!_.isobj(ctx.ist.tmplCache)) ctx.ist.tmplCache = {};
        ctx.ist.tmplCache[value] = elBody;
      }
      if (elBody) ctx._elBody = elBody
      else console.warn('template', value, 'not found');
    }
  };

  var setMod = {
    rx: _.rxAtt(/setc(u)?-([a-z]\w*)$/i),
    cb: function (mkey, value, e, ctx) {
      var u = mkey[1] === 'u' ? '_' : '';
      ctx[u + mkey[2]] = value;
    }
  }

  function dragGoAfter(ev) {
    var rect = ev.target.getBoundingClientRect();
    return (rect.height / 2) < ev.offsetY;
  }

  var dragMod = {
    rx: _.rxAtt(/(drag|drop)(i)?(?:-([a-z]\w*))?$/i),
    cb: function (mkey, value, e, ctx) {
      var op = mkey[1], hasIdx = !!mkey[2], scope = mkey[3],
        apath = pat.expand(value || ctx.lastModel, ctx);
      value = pat.join(apath);
      if (op === 'drag') {
        e.draggable = true;
        e.ondragstart = function (ev) {
          var tsrc = [scope, value].join('\0');
          ev.dataTransfer.setData("text", tsrc);
        };
      } else {
        e.ondragover = function (ev) { ev.preventDefault(); };
        e.ondrop = function (ev) {
          var txt = ev.dataTransfer.getData("text"), data = txt.split('\0');
          if (scope && scope !== data[0]) return;
          ev.stopPropagation();
          var tkv = pat.eval(ctx, apath, null, hasIdx),
            tIdx = tkv.key, tArr = hasIdx ? tkv.o : tkv,
            skv = pat.eval(ctx, data[1], null, true),
            sIdx = skv.key, sArr = skv.o, sObj = sArr.splice(sIdx, 1)[0],
            after = dragGoAfter(ev), fn = after ? 'push' : 'unshift';
          if (after && !_.isnull(tIdx)) tIdx++;
          if (sArr === tArr && sIdx < tIdx - 1) tIdx--;
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
    cb: function (mkey, value, e, ctx) {
      ctx._rpath = modelMod.cb(mkey, value, e, ctx);
      ctx._rkey = pat.expand(ctx._rpath, ctx, true);
      ctx._rskey = pat.join(ctx._rkey);
      ctx._rfrag = document.createDocumentFragment();
      if (!ctx._elBody) ctx._elBody = _.removeParent(e);
      ctx._handleChildren = rptMod.cbChildren;
    },
    cbChildren: function (el, ctx) {
      rptMod.cbChildLoop(el, ctx);
    },
    cbChildLoop: function (el, ctx, start, end) {
      var arr = pat.eval(ctx, ctx._rkey), ist = ctx.ist, kv = {};
      if (domMon) domMon.arrayPath(ctx._rkey, [], '', kv);
      if (ist._domMon) ist._domMon.rptStart(ctx._rskey, el, ctx, kv.key);
      if (!_.isarr(arr)) return;
      start = start || 0; end = end || arr.length;
      // if (ctx.debug & 16) console.log('repeat', start, end, ctx._rkey);
      for (var i = start; i < end; i++)
        rptMod.cbChildItem(arr, i, ctx, el);
      _.append(ctx._rfrag, el);
    },
    cbChildItem: function (arr, i, ctx, el) {
      var ist = ctx.ist, ipath, kv;
      if (!_.in(i, arr)) return null;
      if (domMon) ipath = domMon.arrayPath(ctx._rkey, arr, i, kv = {});
      else ipath = ctx._rkey + '.' + i;
      ctx[ctx._rpath] = ipath;
      var newel = ist._exec(ctx._elBody, ctx, ctx._rfrag);
      ctx[ctx._rpath] = ctx._rkey;
      if (ist._domMon) ist._domMon.rptAdd(ctx._rskey, el, {
        key: kv.key, value: kv.value, ctx: ctx, el: newel
      }, i);
      return newel;
    }
  };

  cls.defaultPatterns = [pat, funcPat];
  cls.defaultModules = [modelMod, tmplMod, setMod, dragMod, rptMod];
})();