

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

const isWord = (str) => (!!str.length && regex.test(str));

// are one or more <element> block elements and 
// has every <element> the same nodeName
const areBlockElement = (...nodes) => nodes.every(
    (node, idx, arr) => (
        ['P'].includes(node.nodeName)
        && arr[0].nodeName === node.nodeName
    )
);

const areElementNode = (...nodes) => nodes.every(
    (node, idx, arr) => (
        node.nodeType === Node.ELEMENT_NODE
    )
);

const areTextNode = (...nodes) => nodes.every(
    (node, idx, arr) => (
        node.nodeType === Node.TEXT_NODE
    )
);

const areStyleNode = (...nodes) => nodes.every(
    (node, idx, arr) => (
        node.hasAttribute('style')
    )
);

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
        console.log('AlignedRange')
        console.table([range])

        if ((range.startContainer === range.endContainer)
            && ('ep' === range.startContainer.className)) {
            console.log(100.1, 'OK');

            super(range);

        } else {
            console.log(100.2);
            console.assert(range.startContainer.nodeType === Node.TEXT_NODE);
            console.assert(range.endContainer.nodeType === Node.TEXT_NODE);

            let startContainer = range.startContainer,
                startOffset = range.startOffset,
                endContainer = range.endContainer,
                endOffset = range.endOffset,
                start = startContainer.parentElement;


            while (!start.contains(endContainer)) {
                start = start.parentElement;
            }

            const iterator = document.createNodeIterator(start);

            let currentNode, removing = false;

            while ((currentNode = iterator.nextNode())) {

                if (removing && (!currentNode.contains(endContainer))) {
                    currentNode.remove();
                }

                if ((currentNode === startContainer) && (startContainer === endContainer)) {
                    console.log(100.21);
                    startContainer.deleteData(startOffset, endOffset - startOffset);
                    endOffset = startOffset;
                    break;
                }

                if (currentNode === startContainer) {
                    startContainer.deleteData(startOffset, startContainer.length - startOffset);
                    removing = true;
                }

                if (currentNode === endContainer) {
                    console.log(100.22);
                    endContainer.deleteData(0, endOffset)
                    break;
                }
            }

            // walk iterator back to find and join block-elements
            while ((currentNode = iterator.previousNode())) {

                if (currentNode === start)
                    break

                if (currentNode.previousSibling
                    && areBlockElement(currentNode.previousSibling, currentNode)) {
                    console.log(100.23);

                    currentNode.previousSibling
                        .append(...currentNode.childNodes);

                    currentNode.remove();
                    break;
                }
            }

            super({
                startContainer: startContainer,
                startOffset: startOffset,
                endContainer: endContainer,
                endOffset: endOffset
            });

        }
    }
}

// Range, der die FF-Fehler korrigiert
class TargetRange extends AlignedRange {

    constructor(range) {
        console.log('TargetRange')
        let startContainer = range.startContainer,
            startOffset = range.startOffset,
            endContainer = range.endContainer,
            endOffset = range.endOffset;

        if (startContainer.nodeType === Node.TEXT_NODE) {

            // FF nimmt den Vorgänger-Knoten und setzt Offset auf seine Textlänge
            if ((startOffset === startContainer.length) && (startContainer !== endContainer)) {

                switch (true) {
                    case (!!startContainer.nextSibling?.data):
                        console.log(0.1, 'never?')
                        break;

                    case (!!startContainer.nextSibling?.firstChild?.data):
                        console.log(0.2)
                        startContainer = startContainer.nextSibling.firstChild;
                        startOffset = 0;
                        break;

                    case (!!startContainer.parentElement.nextSibling?.data):
                        console.log(0.3)
                        startContainer = startContainer.parentElement.nextSibling;
                        startOffset = 0;
                        break;

                    case (!!startContainer.parentElement.nextSibling?.firstChild?.data):
                        console.log(0.4)
                        startContainer = startContainer.parentElement.nextSibling.firstChild;
                        startOffset = 0;
                        break;

                    default:
                        console.log(0.5, 'unknown')
                }

            } else {
                console.log(0, 'ok')
            }
        } else {

            if ('ep' === startContainer.className) {
                console.log(1.1)
                if (startContainer.previousElementSibling?.lastChild) {
                    console.log(1.2)
                    startContainer = startContainer.previousElementSibling.lastChild;
                    startOffset = startContainer.length;
                }

            } else {
                console.log(1.3)

                let node = startContainer.firstElementChild;

                while (node && node.localName !== 'span') {
                    node = node.firstElementChild;
                }

                // <span.ep>?
                startContainer = node.firstChild
                    ? node.firstChild
                    : node;
                startOffset = 0;
            }
        }

        if (endContainer.nodeType === Node.TEXT_NODE) {

            if ((endOffset === 0) && (startContainer !== endContainer)) {

                switch (true) {
                    case (!!endContainer.previousSibling?.data):
                        console.debug(3.1, 'never')
                        break;

                    case (!!endContainer.previousSibling?.firstChild.data):
                        console.debug(3.2)
                        endContainer = endContainer.previousSibling.firstChild;
                        endOffset = endContainer.length;
                        break;

                    case (!!endContainer.parentElement.previousSibling?.data):
                        console.debug(3.3)
                        endContainer = endContainer.parentElement.previousSibling;
                        endOffset = endContainer.length;
                        break;

                    case (!!endContainer.parentElement.previousSibling?.firstChild.data):
                        console.debug(3.4)
                        endContainer = endContainer.parentElement.previousSibling.firstChild;
                        endOffset = endContainer.length;
                        break;

                    default:
                        console.log(3.5, 'unknown')
                }
            } else {
                console.log(4, 'OK')
            }

        } else {

            let node = ('ep' !== endContainer.className)
                ? endContainer.lastElementChild
                : endContainer;

            while (node && node.localName !== 'span') {
                node = node.lastElementChild;
            }

            endContainer = node;

            console.assert('ep' == endContainer.className, 'not: <span.ep>');

            switch (true) {
                case (!!endContainer.previousElementSibling?.lastChild?.firstChild?.data):
                    console.log(5.1)
                    endContainer = endContainer.previousElementSibling.lastChild.firstChild;
                    endOffset = endContainer.length;
                    break

                case (!!endContainer.previousElementSibling?.lastChild?.data):
                    console.log(5.2)
                    endContainer = endContainer.previousElementSibling.lastChild;
                    endOffset = endContainer.length;
                    break

                default:
                    console.log(5.3, 'OK')
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
            collapsed: range.collapsed
        });
    }
}

class TypeWriter {

    constructor(node) {

        node.addEventListener('beforeinput', this);
    }

    onInsertContent(range, data) {
        console.table([range]);
        console.table([data]);

        if (!range.collapsed) {


        }
    }

    onDeleteContent(range) {
        console.log('onDeleteContent');
        console.table([range]);

        let startContainer = range.startContainer,
            startOffset = range.startOffset,
            endContainer = range.endContainer,
            endOffset = range.endOffset;

        if (startContainer === endContainer) {

            if (areTextNode(startContainer)) {

                if (startContainer.length) {
                    console.log(30.1, 'OK')

                } else {
                    console.log(30.2)

                    if (areStyleNode(startContainer.parentElement)) {

                        const parent = startContainer.parentElement;

                        switch (true) {

                            case (!!parent.previousSibling):
                                if (areTextNode(parent.previousSibling)) {
                                    console.log(30.21);
                                    startContainer = parent.previousSibling;

                                } else {
                                    console.log(30.22);
                                    startContainer = parent.previousSibling.firstChild;
                                }
                                break;

                            case (!!parent.nextSibling):
                                if (areTextNode(parent.nextSibling)) {
                                    console.log(30.23, parent.nextSibling);
                                    startContainer = parent.nextSibling;

                                } else {
                                    console.log(30.24);
                                    startContainer = parent.nextSibling.firstChild;
                                }
                                break;

                            default:
                                console.log(30.29);
                                // ein <span style> ohne Vor- und Nachfahren ist alleine im <span>
                                // Dieser <span> kann dann auch weg
                                parent.parentNode.remove();
                                return;
                        }

                        parent.remove();
                        startOffset = startContainer.length;
                        startContainer.parentElement.normalize();

                    } else { // kein <span style>

                        switch (true) {
                            case (!!startContainer.previousSibling):

                                if (areTextNode(startContainer.previousSibling)) {
                                    console.log(30.31, 'never')
                                    startContainer = startContainer.previousSibling
                                } else { // Kann nur <span style> sein
                                    console.log(30.32)
                                    startContainer = startContainer.previousSibling.firstChild;
                                }

                                startOffset = startContainer.length;
                                range.startContainer.remove();

                                break;

                            case (!!startContainer.nextSibling):

                                if (areTextNode(startContainer.nextSibling)) {
                                    console.log(30.41)
                                    startContainer = startContainer.nextSibling;
                                } else {
                                    console.log(30.42)
                                    startContainer = startContainer.nextSibling.firstChild;
                                }

                                startOffset = 0;
                                range.startContainer.remove();

                                break;

                            default:
                                console.log(30.9)
                                // ein leerer startContainer ohne Vor- und Nachfahren
                                // ist in einem leeren <span>; dieser kann weg
                                startContainer.parentElement.remove();
                        }

                    }
                }
            } else { // ELEMENT_NODE
                console.log(30.8)

            }
            // END if (startContainer === endContainer)
        } else {

            switch (true) {
                case areTextNode(startContainer, endContainer):

                    if (isWord(startContainer) && isWord(endContainer)) {
                        console.log(29.2)

                        if (!startContainer.parentElement.contains(endContainer)) {

                            switch (true) {
                                case areStyleNode(startContainer.parentElement, endContainer.parentElement):
                                    console.log(30.9111, 'OK')
                                    break;

                                case areStyleNode(startContainer.parentElement):
                                    console.log(30.9112, 'OK')
                                    break;

                                case areStyleNode(endContainer.parentElement):
                                    console.log(30.9113, 'never')
                                    break;

                                default:
                                    console.log(30.9119)
                                    startContainer.after(endContainer.cloneNode());
                                    endContainer.parentElement.remove();
                            }
                        }

                        break;
                    }

                    if (!startContainer.length) {

                        if (areStyleNode(startContainer.parentElement)) {

                            const parent = startContainer.parentElement;

                            switch (true) {
                                case (!!parent.previousNode):
                                    if (areStyleNode(parent.previousNode)) {
                                        console.log(40.1);

                                    } else {
                                        console.log(40.2);

                                    }
                                    break;

                                case (!!parent.nextNode):
                                    if (areStyleNode(parent.nextNode)) {
                                        console.log(40.3);

                                    } else {
                                        console.log(40.4);

                                    }
                                    break;

                                default:
                                    console.log(40.9)
                                    // ein <span style> ohne Vor- und Nachfahren ist alleine im <span>
                                    // Dieser <span> kann dann auch weg
                                    if (!parent.parentElement.contains(endContainer)) {
                                        console.log(40.91)
                                        parent.parentElement.remove()
                                    } else {
                                        console.log(40.92)
                                        parent.remove()
                                    }
                            }
                        } else {

                            switch (true) {
                                case (!!startContainer.previousNode):

                                    if (areStyleNode(startContainer.previousNode)) {
                                        console.log(41.1);
                                        startContainer = startContainer.previousNode.firstChild;
                                    } else {
                                        console.log(41.2);
                                        startContainer = startContainer.previousNode;
                                    }
                                    break;

                                case (!!startContainer.nextNode):

                                    if (areStyleNode(startContainer.nextNode)) {
                                        console.log(41.3)
                                        startContainer = startContainer.nextNode.firstChild;
                                    } else {
                                        console.log(41.4)
                                        startContainer = startContainer.nextNode;
                                    }
                                    break;

                                default:

                                    if (!startContainer.parentElement.contains(endContainer)) {
                                        console.log(41.91)
                                        startContainer.parentElement.remove()
                                    } else {
                                        console.log(41.92)
                                        startContainer.remove()
                                    }
                            }
                        }
                    }

                    console.log(50.1, endContainer.length);
                    if (!endContainer.length) {

                        if (areStyleNode(endContainer.parentElement)) {

                            const parent = endContainer.parentElement;

                            switch (true) {
                                case (!!parent.previousNode):
                                    if (areStyleNode(parent.previousNode)) {
                                        console.log(42.1);

                                    } else {
                                        console.log(42.2);

                                    }
                                    break;

                                case (!!parent.nextNode):
                                    if (areStyleNode(parent.nextNode)) {
                                        console.log(42.3);

                                    } else {
                                        console.log(42.4);

                                    }
                                    break;

                                default:
                                    // ein <span style> ohne Vor- und Nachfahren ist alleine im <span>
                                    // Dieser <span> kann dann auch weg
                                    console.log(42.91)
                                    const grandpa = parent.parentElement;
                                    parent.remove();

                                    if (!grandpa.childNodes.length) {
                                        console.log(42.92)
                                        grandpa.remove()
                                    } else console.log(42.92, grandpa.childNodes);
                            }
                        } else {
                            switch (true) {
                                case (!!endContainer.previousNode):

                                    if (areStyleNode(endContainer.previousNode)) {
                                        console.log(43.1);
                                        endContainer = endContainer.previousNode.firstChild;
                                    } else {
                                        console.log(43.2);
                                        endContainer = endContainer.previousNode;
                                    }
                                    break;

                                case (!!endContainer.nextNode):

                                    if (areStyleNode(endContainer.nextNode)) {
                                        console.log(43.3)
                                        endContainer = endContainer.nextNode.firstChild;
                                    } else {
                                        console.log(43.4)
                                        endContainer = endContainer.nextNode;
                                    }
                                    break;

                                default:

                                    //if (!endContainer.parentElement.contains(startContainer)) {
                                    if (endContainer.parentElement === startContainer.parentElement) {
                                        console.log(43.91)
                                        endContainer.parentElement.remove()
                                    } else {
                                        console.log(43.92)
                                        endContainer.remove()
                                    }
                            }
                        }
                    } else {
                        console.log(50)
                    }

                    break;

                case areElementNode(startContainer, endContainer):
                    console.log(30.92, 'never');
                    break

                default:
                    console.log(30.99, 'never');
            }
        }
        document
            .getSelection()
            .collapse(startContainer, startOffset);
        //startContainer.parentElement.normalize()
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
    }
}

class Writer {

    constructor(node) {

        const input = new TypeWriter(node);

        node.contentEditable = true;
    }
}

export { Writer }