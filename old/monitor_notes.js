/*
  - curlyPat
    - store original patterns, model references, DOM values
    - recalc: 
      - check recorded model paths, 
      - compare DOM values, calculate current values
      - if change, update
  - rptMod:
    - value stuff handled by curlyPat section
    - this module really only needs to focus on array-specific ops:
      - add:
      - remove:
      - ordering: 
    - state: key, DOM range
      - key: `...i=key=value...`. In repeat path: `...=key`
        - complicates curlyPat somewhat
      - DOM range: store first/last 
        * what about leading/trailing text nodes? too unstable
          maybe insert leading/trailing comment nodes?
          maybe only use elements?
    - recalc:
      - check array of DOM keys, compare current keys
      - adds: create
      - removes: delete
      - order: move
*/