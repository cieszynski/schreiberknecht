
const evaluateXPath = (node, xpath) => document.evaluate(
    xpath,
    node,
    null,
    9,
    null
).singleNodeValue;

const createSpan = (text) => {
    const elem = document.createElement('span');
    elem.append(new Text(text));
    //elem.innerText = text;

    switch (text) {
        case ' ':
            elem.className = 'sp';
            break;
        case ',':
            elem.className = 'cm';
            break;
        default:
            elem.className = 'w';
    }
    return elem;
}

const createSpanBr = (name = 'br') => {
    const elem = document.createElement('span');
    elem.append(document.createElement('br'));
    elem.className = 'br';
    return elem;
}

const joinNodes = (node1, node2) => {
    // TODO
    node1.innerText += node2.innerText;
    node2.remove();
}

const splitNode = (node, pre, post, data) => {
    const sp = createSpan(data);

    if (pre) {
        node.innerText = pre;
        node.after(sp);
    } else {
        node.replaceWith(sp);
    }

    if (post) {
        const span = createSpan(post);
        sp.after(span);
    }

    document
        .getSelection()
        .collapse(sp.firstChild, 1);
}

// https://en.wikipedia.org/wiki/Punctuation
const findClassName = (punctuation) => {
    const marks = {
        '\n': 'br',
        ' ': 'sp',
        '?': 'qm',
        '!': 'em',
        ',': 'cm'
    }

    return marks?.[punctuation] || 'xx';
};

// https://stackoverflow.com/questions/150033/
const regex = new RegExp(/([^\u00C0-\u1FFF\u2C00-\uD7FF\w])/vi);

const tokenize = (string) => string.split(regex).filter(token => token.length);

function parse(string) {

    const nodes = [];

    string.split(regex).forEach(token => {

        if (token.length >= 1) {

            const span = document.createElement('span');
            span.appendChild(new Text(token));

            if (!regex.test(token)) {
                span.className = 'w';

            } else {
                span.className = findClassName(token);
            }

            nodes.push(span);
        }
    })

    return nodes;
}


const mergeContainer = (target, source) => {

    const offset = target.firstChild.length;

    while (source.firstChild) {
        target.appendChild(source.firstChild);
    }

    target.normalize();
    source.remove();

    console.log(offset, target.firstChild.length)
    document
        .getSelection()
        .collapse(target.firstChild, offset);

}

// Range, der die Informationen für den Gebrauch bereitstellt
class AlignedRange extends StaticRange {

    constructor(range) {

        let start = range.startContainer,
            end = range.endContainer,
            left = start,
            right = end,
            leftOffset = range.startOffset,
            rightOffset = range.endOffset;

        const nodes = new Set();

        while (!left.contains(end)) {

            let next = left.nextSibling;

            while (next && !next.contains(end)) {
                nodes.add(next);
                next = next.nextSibling;
            }

            if (left.parentElement.contains(end))
                break;

            left = left.parentElement;
        }


        while (!right.contains(start)) {

            let prev = right.previousSibling;

            while (prev && !prev.contains(start)) {
                nodes.add(prev);
                prev = prev.previousSibling;
            }

            if (right.parentElement.contains(start))
                break;

            right = right.parentElement;
        }

        nodes.forEach(item => item.remove());

        switch (true) {
            case ((left.nodeType === right.nodeType) && (left.nodeType === Node.TEXT_NODE)): {

                if (left === right) {
                    console.log(101, left, right, range.startOffset, range.endOffset)
                    left.replaceData(range.startOffset, range.endOffset - range.startOffset, '');
                    rightOffset = range.startOffset;
                    // if (!left.length) {
                    //     const parent = left.parentElement;
                    //     left = right = parent?.previousElementSibling
                    //         || parent.nextElementSibling;
                    //     parent.remove();
                    // }
                } else {
                    console.log(102, left, right, range.startOffset, range.endOffset)

                    left.replaceData(range.startOffset, left.length - range.startOffset, '');
                    leftOffset = left.length;
                    right.replaceData(0, range.endOffset, '');
                    rightOffset = 0;
                }
                break;
            }

            case ((left.nodeType === right.nodeType) && (left.nodeType === Node.ELEMENT_NODE)): {
                if (left === right) {
                    // <span.ep>
                    console.log(201, left, right, range.startOffset, range.endOffset)

                } else {
                    // <span.sp><span.w>, <span.w><span.w>
                    console.log(202, left, right, range.startOffset, range.endOffset)

                    left.firstChild.replaceData(range.startOffset, left.firstChild.length - range.startOffset, '');
                    right.firstChild.replaceData(0, range.endOffset, '');
                    rightOffset = range.startOffset;

                    // <span.w><span.w>
                    if (left.className == 'w' && right.className == 'w') {
                        // left.firstChild.appendData(right.firstChild.data);
                        // right.remove();
                        // left = right = left.firstChild;
                        // break;
                    }

                    // <span.sp><span.w>
                    if (left.className == 'w' || right.className == 'w') {
                        console.log(203)
                    }
                }
                break;
            }
            default:
                console.log(404, left, right, range.startOffset, range.endOffset)
        }

        super({
            startContainer: left,
            startOffset: leftOffset,
            endContainer: right,
            endOffset: rightOffset,
            collapsed:
                (left === right)
                && (range.startOffset == range.endOffset)
        });
    }
}

// Range, der die FF-Fehler korrigiert
class TargetRange extends AlignedRange {

    constructor(range) {

        let startContainer = range.startContainer,
            startOffset = range.startOffset,
            endContainer = range.endContainer,
            endOffset = range.endOffset;

        if (range.startContainer.nodeType === Node.TEXT_NODE) {

            // Sorgt dafür, dass zwischen zwei TEXT_NODES der vorherige
            // ausgewählt wird und offset auf die Länge des TEXT_NODES
            if (range.startOffset == 0 && range.endOffset == 0) {
                // console.debug(1001)
                startContainer = evaluateXPath(range.startContainer, `
                      (
                        ../preceding-sibling::span/text() | 
                        ./preceding-sibling::span/text() |
                        ../preceding-sibling::text() |
                        ./preceding-sibling::text() 
                      )[last()]
                    `
                ) || startContainer;

                if (startContainer !== range.startContainer) {
                    startOffset = startContainer.data.length;
                }

                if (range.collapsed) {
                    endContainer = startContainer;
                    endOffset = startOffset;
                }
            }
        }

        // Passiert im FF u.a. wenn mit Strg+A der gesamte Textbereich
        // ausgewählt wird: Dann ist StartContainer kein TEXT_NODE,
        // sondern ein Block-Element
        if (range.startContainer.nodeType === Node.ELEMENT_NODE) {

            if ('ep' === range.startContainer.className) {
                // console.debug(1002, range.startContainer)

                startContainer = evaluateXPath(range.startContainer, `
                    (
                        ./preceding-sibling::span/text()
                    )[last()]
                    `
                ) || range.startContainer;

                // Wenn ein TEXT_NODE gefunden wurde, Offset ist das letzte Zeichen,
                // ansonsten 0, <span.ep>
                startOffset = startContainer?.data?.length || 0;
            }

            // Wenn der StartContainer ein Block-Element ist, dann den ersten
            // TEXT_NODE oder <span.ep> im Element finden

            if (['DIV', 'ARTICLE', 'P'].includes(range.startContainer.nodeName)
                && (range.startOffset == 0 && range.endOffset >= 1)) {

                // console.debug(1003, range.startContainer)

                startContainer = evaluateXPath(range.startContainer, `
                    (
                        .//span/text() |
                        .//span[@class='ep']
                    )[1]
                    `
                );

                // startOffset bleibt 0
            }
        }

        // Passiert im FF u.a. wenn mit Strg+A der gesamte Textbereich
        // ausgewählt wird: Dann ist EndContainer kein TEXT_NODE,
        // sondern ein Block-Element
        if (range.endContainer.nodeType === Node.ELEMENT_NODE) {

            // Passiert im FF, wenn mit der Maus ein Bereich bist zum Textende
            // ausgewählt wird
            if ('ep' === range.endContainer.className) {
                // console.debug(1004, range.endContainer)

                endContainer = evaluateXPath(range.endContainer, `
                    (
                        ./preceding-sibling::span/text()
                    )[last()]
                    `
                ) || range.endContainer;

                // Wenn ein TEXT_NODE gefunden wurde, Offset ist das letzte Zeichen,
                // ansonsten 0, <span.ep>
                endOffset = endContainer?.data?.length || 0;

            }

            // Wenn der Endcontainer ein Block-Element ist, dann den letzten
            // TEXT_NODE oder <span.ep> im Element finden
            if (['DIV', 'ARTICLE', 'P'].includes(range.endContainer.nodeName)
                && (range.startOffset == 0 && range.endOffset >= 1)) {

                // console.debug(1005, range.endContainer)

                endContainer = evaluateXPath(range.endContainer, `
                      (
                        .//span[@class='ep'][not(preceding-sibling::span)] |
                        .//span/text()
                    )[last()]
                `);

                // Wenn ein TEXT_NODE gefunden wurde, Offset ist das letzte Zeichen,
                // ansonsten 0, (<span.ep>)
                endOffset = endContainer?.data?.length || 0;
            }
        }

        console.assert(startContainer.nodeType === Node.TEXT_NODE
            || startContainer.className === 'ep');
        console.assert(endContainer.nodeType === Node.TEXT_NODE
            || endContainer.className === 'ep');

        super({
            startContainer: startContainer,
            startOffset: startOffset,
            endContainer: endContainer,
            endOffset: endOffset,
            collapsed:
                (startContainer === endContainer)
                && (startOffset == endOffset)
        });

    }
}

class TypeWriter {

    constructor(node) {

        node.addEventListener('beforeinput', this);
    }

    onInsertContent1(startNode, endNode, startOffset, endOffset, data) {
        console.debug('onInsertContent', {
            startNode: startNode,
            startOffset: startOffset,
            endNode: endNode,
            endOffset: endOffset,
            equal: startNode === endNode,
            data: data
        });

        const selection = document.getSelection();
        console.debug(selection.anchorNode)

        const pre = startNode.innerText.slice(0, startOffset)
        const post = endNode.innerText.slice(endOffset)

        if (startNode === endNode) {
            if ('ep' === startNode.className) {
                console.debug('ep');

                const span = createSpan(data);
                startNode
                    .before(span);
                document
                    .getSelection()
                    .collapse(span.firstChild, startOffset + data.length);
                return;
            }

            if ('w' === startNode.className) {
                console.debug('WORD');

                const span = createSpan(data);

                return;
            }

            if (['sp', 'br', 'cm'].includes(startNode.className)) {
                console.debug('SIGNS');
                const span = createSpan(data);


                return;
            }

            throw new Error(`unknown className: ${startNode.className}`)
        }
    }

    onInsertContent2(range, data) {
        console.table([range]);

        const content = parse(data);
        let tokens = tokenize(data);

        if (range.collapsed) {

            // leeres <p>, container ist <span.ep>
            if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
                console.debug(1001)

                const nodes = tokens.map(token => {
                    const span = document.createElement('span');
                    span.appendChild(new Text(token));

                    if (regex.test(token)) {
                        span.className = findClassName(token);
                    } else {
                        span.className = 'w';
                    }
                    try {
                        document
                            .getSelection()
                            .collapse(span, token.length);
                    } catch (ex) { console.error(ex) }
                    return span;
                });

                range.startContainer.before(...nodes);

                return;
            }


            if (range.startContainer.nodeType === Node.TEXT_NODE) {
                console.debug(1002)

                tokens.unshift(range.startContainer.data.slice(0, range.startOffset));
                tokens.push(range.startContainer.data.slice(range.startOffset));

                const nodes = [];

                tokens = tokens.filter(token => token.length);

                for (let n = 0; n < tokens.length; n++) {
                    const span = document.createElement('span');

                    if (!regex.test(tokens[n])) {

                        if ((n < tokens.length - 1) && !regex.test(tokens[n + 1])) {
                            span.appendChild(new Text(tokens[n] + tokens[n + 1]));
                            n++;
                        } else {
                            span.appendChild(new Text(tokens[n]));
                        }
                        span.className = 'w';
                    } else {
                        span.appendChild(new Text(tokens[n]));
                        span.className = findClassName(tokens[n]);
                    }

                    nodes.push(span)
                }
                //const nodes = tokens.map((token, idx, arr) => {

                //     if ((!regex.test(prev)) && (!regex.test(cur))) {
                //         return prev + cur
                //     } else {
                //         return cur
                //     }
                // })
                console.log(tokens, nodes)
                range.startContainer.parentElement.replaceWith(...nodes);
                return;
            }
        } else {
            console.debug(2000)

        }
        return
        console.debug(tokens);

        if (range.startContainer.nodeType === Node.ELEMENT_NODE
            && range.endContainer.nodeType === Node.ELEMENT_NODE) {
            console.debug(1000)

            // leeres <p>, container ist <span.ep>
            if (range.startContainer === range.endContainer) {
                console.debug(1001)

                const nodes = tokens.map(token => {
                    const span = document.createElement('span');
                    span.appendChild(new Text(token));

                    if (regex.test(token)) {
                        span.className = findClassName(token);
                    } else {
                        span.className = 'w';
                    }

                    document
                        .getSelection()
                        .collapse(span, token.length);
                    return span;
                });

                range.startContainer.before(...nodes);
            } else {
                console.debug(1002)
            }
        }

        if (range.startContainer.nodeType === Node.TEXT_NODE
            && range.endContainer.nodeType === Node.TEXT_NODE) {

            if (range.startContainer === range.endContainer) {

                if (range.startContainer.parentElement.style.length) {
                    console.debug(2000)

                } else {
                    console.debug(2010)

                    if (regex.test(token)) {

                    } else {
                        const text1 = range.startContainer;
                        const text2 = text1.splitText(range.startOffset);
                        const text3 = new Text(token)
                    }
                }
            } else {
                console.debug(3000)

            }
            /*
            if (range.startContainer === range.endContainer) {

                const text1 = range.startContainer;
                const text2 = text1.splitText(range.startOffset);
                const parent = range.startContainer.parentElement;
                const pre = content.shift();

                if (parent.className == 'w' && pre.className == 'w') {
                    console.debug(2010)
                    text1.after(pre.firstChild, text2);

                    document
                        .getSelection()
                        .collapse(text2);

                    parent.normalize();

                    return;
                }

                if (parent.className == 'w') {
                    console.debug(2011)

                    if (text2.data) {
                        console.debug(2012)
                        const span = document.createElement('span');
                        // verschiebt text2 von parent nach span:
                        span.appendChild(text2);
                        span.className = 'w';
                        parent.after(pre, span);

                        document
                            .getSelection()
                            .collapse(text2);
                    } else {
                        console.debug(2013)
                        parent.after(pre);

                        document
                            .getSelection()
                            .collapse(pre, 1);
                    }
                    return;

                }

                if (parent.className != 'w') {
                    console.debug(2014)

                    if (pre.className == 'w' && (parent.nextElementSibling && parent.nextElementSibling.className == 'w')) {
                        console.debug(2015)
                        parent.nextElementSibling.appendChild(pre.firstChild)

                        document
                            .getSelection()
                            .collapse(pre, 1);
                        parent.nextElementSibling.normalize();
                    } else {
                        console.debug(2016)
                        parent.after(pre);

                        document
                            .getSelection()
                            .collapse(pre, 1);
                    }
                }
            } else {
                console.debug(3000)
            }
                */
        }
    }


    onInsertContent(range, data) {
        console.table([range]);
        console.table([data]);

        if (!range.collapsed) {


        }
    }

    onDeleteContent(range) {
        console.table([range]);

        // Start und Ende sind Textknoten
        if ((range.startContainer.nodeType === range.endContainer.nodeType)
            && (range.startContainer.nodeType === Node.TEXT_NODE)) {

            if (range.startContainer === range.endContainer) {
                console.log(3010)
                // <span.cm><span.w><span.cm>
                //          --------
                // oder text|text ergibt leeren <span.w>
            } else {
                console.log(3020)

            }

            return;
        }

        // Start und Ende sind Elementknoten
        if ((range.startContainer.nodeType === range.endContainer.nodeType)
            && (range.startContainer.nodeType === Node.ELEMENT_NODE)) {

            // Start und Ende sind derselbe Knoten
            if (range.startContainer === range.endContainer) {
                console.log(3030)

                switch (range.startContainer.className) {
                    case 'ep':
                        // wenn Vorgänger, dann <span>
                        if (range.startContainer.previousElementSibling) {
                            document
                                .getSelection()
                                .collapse(range.startContainer.previousElementSibling,
                                    range.startContainer.previousElementSibling.firstChild.length
                                );
                        } else {
                            document
                                .getSelection()
                                .collapse(range.startContainer, 0);
                        }
                        return;

                    default:
                        console.log(3031, range.startContainer.className)

                }

            } else {    // Start und Ende sind verschiedene Knoten
                console.log(3040)

                // startContainer ist leer
                if (range.startContainer.firstChild?.length === 0) {
                    console.log(3041)

                    if (range.startContainer.previousElementSibling?.className == 'w'
                        && range.startContainer.nextElementSibling?.className == 'w') {
                        console.log(3042)

                        mergeContainer(
                            range.startContainer.previousElementSibling,
                            range.startContainer.nextElementSibling);
                    }

                    range.startContainer.remove();
                }

                // endContainer ist leer
                if (range.endContainer.firstChild?.length === 0) {
                    console.log(3045)

                    if (range.endContainer.previousElementSibling?.className == 'w'
                        && range.endContainer.nextElementSibling?.className == 'w') {
                        console.log(3046)

                        mergeContainer(
                            range.endContainer.previousElementSibling,
                            range.endContainer.nextElementSibling);
                    } else {
                        console.log(3047)
                        if (range.startContainer.firstChild?.length) {
                            // FIREFOX
                            document
                                .getSelection()
                                .collapse(
                                    range.startContainer.firstChild,
                                    range.startContainer.firstChild.length)
                        }
                    }

                    range.endContainer.remove();
                }
            }

            return;
        }

        console.log(3050)
    }

    handleEvent(event) {
        console.clear();
        event.preventDefault();

        const [range] = event.getTargetRanges();

        const targetrange = new TargetRange(range);

        const data = function (event) {
            if (event.dataTransfer) {
                return event.dataTransfer
                    .getData('text/plain');
            }

            return event.data; // kann null sein
        }(event);

        //console.log(targetrange)

        switch (event.inputType) {
            case 'insertText':
            case 'insertFromPaste':
                return this.onInsertContent(targetrange, data);

            case 'deleteContentBackward':
            case 'deleteContentForward':
                return this.onDeleteContent(targetrange);

            default:
                console.log(event.inputType);
        }
        return

        console.dir(range, section)

        const [startNode, startOffset, endNode, endOffset] = function (start, offset1, end, offset2) {

            if (start === end) {
                if (start.nodeType === Node.TEXT_NODE) {
                    start = start.parentElement;

                    while (start.style.length) {
                        start = start.parentElement;
                    }

                    end = start;
                }

                if (start === event.target || ['ARTICLE', 'P'].includes(start.nodeName)) {
                    start = end = evaluateXPath(start, '(.//span)[1]');
                }

                if (start.className == 'ep' && start.previousElementSibling) {
                    start = end = start.previousElementSibling;
                }

                if (start.className == 'br' && start.previousElementSibling) {
                    start = end = start.previousElementSibling;
                }

                if (['sp', 'cm'].includes(start.className)) {
                    if (offset1 === 0 && offset2 === 0 && start.previousElementSibling) {
                        start = end = start.previousElementSibling;
                        offset1 = offset2 = start.innerText.length
                    }
                }
            } else {

            }

            return [start, offset1, end, offset2]
        }(range.startContainer, range.startOffset, range.endContainer, range.endOffset)

        console.debug('from range:\n', {
            startNode: startNode,
            startOffset: startOffset,
            endNode: endNode,
            endOffset: endOffset,
            equal: startNode === endNode
        })

        return

        if (startNode !== endNode) {
            console.log(startNode, endNode)
            //console.log(startText.parentElement, endText.parentElement)

            const startBlock = startNode.closest('p, h1');
            const endBlock = endNode.closest('p, h1');

            if (startNode.contains(endNode)) {
                console.info('TODO: startNode.contains(endNode)')
            } else {
                console.log(startNode, endNode)
                if (startBlock === endBlock) {
                    let next = startNode.nextElementSibling;

                    while (next && next !== endNode) {
                        next = next.nextElementSibling;
                        next?.previousElementSibling.remove();
                    }
                } else {
                    let nextBlock = startBlock.nextElementSibling;

                    while (nextBlock && nextBlock !== endBlock) {
                        const current = nextBlock;
                        nextBlock = nextBlock.nextElementSibling;
                        current.remove();
                    }

                    let nextNode = startNode.nextElementSibling;

                    while (nextNode && nextNode.className !== 'br') {
                        const current = nextNode;
                        nextNode = nextNode.nextElementSibling;
                        current.remove();
                    }

                    let prevNode = endNode.previousElementSibling;

                    while (prevNode) {
                        const current = prevNode;
                        prevNode = prevNode.previousElementSibling;
                        current.remove();
                    }
                }
            }
        }

        switch (event.inputType) {
            case 'insertText':
                return this.onInsertContent(startNode, endNode, startOffset, endOffset, event.data);
            default:
                console.log(event.inputType);
        }
    }
}

class Writer {

    constructor(node) {

        const input = new TypeWriter(node);

        node.contentEditable = true;
    }
}

export { Writer }