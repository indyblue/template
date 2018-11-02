    /*
    todo
    - change append and stuff to use document.createDocumentFragment
      - for better reflows.
    - change exec/expend to have external/internal breakout
      - to allow reliable access to top level model object

    - handle Element, Text, Comment
      - replaces - regex replace on text, loop through attr-values
      - elements that use attributes...can we use attr loop above to get attr values?
        - maybe load into state?
    - operations:
      - replace[path/formula] (Text, attr-value)
        - what if replaces inside repeats didn't repackage data?
          - maybe use path combining instead to always use original model?
          - repackage more efficient from CPU, but less from RAM?
      - repeat (Element, attr-key, attr-value)
        - paginate (element, attr-key, attr-value)
        - *** allow alias attribute
          - alias-x="path", where x = alias and path = model path
          - if path is blank, alias belongs to root
          - if path is blank inside of repeat, alias equals repeat path
          - useful esp if template will be used both separately and also in repeat
      - template (Element, attr-key, attr-value)
        - what about by element name?
        - what about react type structure to allow encapsulating state/render logic?
      - binding
        - DOM to model - use events
        - model to DOM (either proxy or getter function & "dirty checking"
          - store reads, values, and context in array
          - need to handle arrays with a key value to support ordering etc


    - module rewrite
      - repeat remove - add comment before and after to identify region for use by dirty apply
      - { match: checked via element.matches() (matches doesn't work on #text, probably also not
        attrs: { name: regexp } - 

      - type = string with t(text), v(attr-val), k(attr-key), e(element)
      - rank = order of execution
      - within RegExp.replace: cbReplace, cbMatch
      - apply: cbEval, cbChildren, cbCleanup
    - state rewrite
      - put removeParent into state
    - dirty checking
      - track property usage without Proxy
      - deep copy
      - apply
      - loop add/sub/sort
    */