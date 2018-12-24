(function () {
  var jh = {
    ondata: function (event) {
      if (typeof event.data === 'string') {
        try { var obj = JSON.parse(event.data); } catch (ex) { }
        if (obj) {
          for (var i = 0; i < jh.cbJson.length; i++) {
            var h = jh.cbJson[i], m = false;
            if (!h.event) m = true;
            if (h.event === obj.event) m = true;
            else if (h.event instanceof RegExp && h.event.test(obj.event)) m = true;
            if (m) h.cb.bind(this)(obj.payload, obj.event, event);
          }
        } else if (jh.cbText) jh.cbText.bind(this)(event);

      } else if (jh.cbBinary) jh.cbBinary.bind(this)(event);
    },
    connections: [],
    cbJson: [],
    addCbJson: function (event, cb) {
      jh.cbJson.push({ event: event, cb: cb });
      return jh;
    },
    cbText: null,
    cbBinary: null,
    cbConn: null,
    sendJson: function (event, payload, ws) {
      var conns = jh.connections;
      if (ws) conns = [ws];
      var data = { event: event, payload: payload };
      var txt = JSON.stringify(data);
      for (var i = 0; i < conns.length; i++) conns[i].send(txt);
    },
    addConn: function (ws) {
      if (jh.connections.indexOf(ws) === -1) jh.connections.push(ws);
      if (jh.cbConn) jh.cbConn(ws);
    },
    remConn: function (ws) {
      var i = jh.connections.indexOf(ws);
      if (i >= 0) jh.connections.splice(i, 1);
    }
  }

  if (typeof module === 'object') module.exports = jh;
  if (typeof window === 'object') window.jsonWsHandler = jh;
})();