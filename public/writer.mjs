
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

class RangePart {

    constructor(node, offset) {

        const path = [];

        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement;

            path.push({ node: node, offset: offset });

            while (node.style.length) {
                let prev = node.previousSibling;
                let offset = 0;

                while (prev) {
                    offset++; // Nodes, nicht Zeichen
                    prev = prev.previousSibling;
                }

                node = node.parentElement;
                path.push({ node: node, offset: offset });
            }
        }

        Object.defineProperties(this, {
            'node': {
                get: () => node
            },
            'path': {
                get: () => path
            }
        });

        Object.freeze(this);
    }
}

class RangeContainer {

    constructor(range) {

        const start = new RangePart(range.startContainer, range.startOffset);
        //const end = new RangePart(range.endContainer, range.endOffset);

        Object.defineProperties(this, {
            'start': {
                get: () => start
            },
            'end': {
                get: () => end
            }
        });

        Object.freeze(this);
    }
}

class TargetRange extends StaticRange {

    constructor(range) {

        let startContainer = range.startContainer,
            startOffset = range.startOffset,
            endContainer = range.endContainer,
            endOffset = range.endOffset;

        if (range.startContainer.nodeType === Node.TEXT_NODE) {

            // Sorgt dafür, dass zwischen zwei TEXT_NODES der vorherige
            // ausgewählt wird und offset auf die Länge des TEXT_NODES
            if (range.startOffset == 0 && range.endOffset == 0) {
                console.debug(1001)
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
                console.debug(1002, range.startContainer)

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

                console.debug(1003, range.startContainer)

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
                console.debug(1004, range.endContainer)

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

                console.debug(1005, range.endContainer)

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

    onInsertContent(startNode, endNode, startOffset, endOffset, data) {
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

    handleEvent(event) {
        event.preventDefault();

        const [range] = event.getTargetRanges();

        const section = new TargetRange(range);

        //  console.clear()

        console.log(range)
        console.log(section)
        //console.log(range, section)//section.start.node, section.start.path)
        //console.log(parse("hallo welt, wie geht's dir?\nVielleicht átwas bässer!").map(node => node.outerHTML))
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