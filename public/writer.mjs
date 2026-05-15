

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
        ['ARTICLE', 'DIV', 'P'].includes(node.nodeName)
        && arr[0].nodeName === node.nodeName
    )
);

const areElementNode = (...nodes) => nodes.every(
    (node, idx, arr) => (
        node?.nodeType === Node.ELEMENT_NODE
    )
);

const areTextNode = (...nodes) => nodes.every(
    (node, idx, arr) => (
        node.nodeType === Node.TEXT_NODE
    )
);

const areStyleNode = (...nodes) => nodes.every(
    (node, idx, arr) => (
        areElementNode(node) && node.hasAttribute('style')
    )
);

const areSpanNode = (...nodes) => nodes.every(
    (node, idx, arr) => (
        areElementNode(node) && node.nodeName === 'SPAN'
    )
);

const areEpNode = (...nodes) => nodes.every(
    (node, idx, arr) => (
        areElementNode(node) && 'ep' == node.className
    )
);

const areWordNode = (...nodes) => nodes.every(
    (node, idx, arr) => (
        areElementNode(node) && 'w' == node.className
    )
);

const areEmpty = (...nodes) => nodes.every(
    (node, idx, arr) => (
        (areElementNode(node) && !node.innerHTML) ||
        (areTextNode(node) && node.length === 0)
    )
);

const containStyleNodes = (...nodes) => nodes.every(
    (node, idx, arr) => Array.from(node.childNodes)
        .some((child) => areStyleNode(child))
)

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


// Range, der die FF-Fehler korrigiert
class TargetRange1 extends StaticRange {

    constructor(range) {
        console.log('TargetRange')
        console.table([range])

        let startContainer = range.startContainer,
            startOffset = range.startOffset,
            endContainer = range.endContainer,
            endOffset = range.endOffset;

        if (areElementNode(startContainer)) {

            while (!areSpanNode(startContainer)) {
                console.log(1, startContainer)
                startContainer = startContainer.firstElementChild;
            }

            if (areEpNode(startContainer) && startContainer.previousElementSibling) {
                console.log(2, startContainer)
                startContainer = startContainer.previousElementSibling
            }

            if (!areEpNode(startContainer)) {

                if (!areStyleNode(startContainer.firstChild)) {
                    if (containStyleNodes(startContainer)) {
                        startContainer = startContainer.childNodes[startOffset].firstChild
                    } else {
                        startContainer = startContainer.firstChild;
                    }
                } else {
                    startContainer = startContainer.firstChild.firstChild;
                }

            }

            startOffset = 0;
        }


        if (areElementNode(endContainer)) {

            while (!areSpanNode(endContainer)) {
                endContainer = endContainer.lastElementChild;
            }

            if (areEpNode(endContainer) && endContainer.previousElementSibling) {
                endContainer = endContainer.previousElementSibling
            }

            if (!areEpNode(endContainer)) {

                if (!areStyleNode(endContainer.lastChild)) {
                    endContainer = endContainer.lastChild;
                } else {
                    endContainer = endContainer.lastChild.firstChild;
                }

                endOffset = endContainer.length;

            } else {
                endOffset = 0;
            }
        }

        if (!areEpNode(startContainer, endContainer)) {

            let start = startContainer.parentElement;

            while (!start.contains(endContainer)) {
                start = start.parentElement;
            }

            const iterator = document.createNodeIterator(start);

            let currentNode, removing = false;

            while ((currentNode = iterator.nextNode())) {

                if (removing && (!currentNode.contains(endContainer))) {
                    console.log(100.20);
                    currentNode.remove();
                }

                if ((currentNode === startContainer) && (startContainer === endContainer)) {
                    console.log(100.21);
                    startContainer.deleteData(startOffset, endOffset - startOffset);
                    endOffset = startOffset;
                    break;
                }

                if (currentNode === startContainer) {
                    console.log(100.22);
                    startContainer.deleteData(startOffset, startContainer.length - startOffset);
                    removing = true;
                }

                if (currentNode === endContainer) {
                    console.log(100.23);
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
                    console.log(100.24);

                    currentNode.previousSibling
                        .append(...currentNode.childNodes);

                    currentNode.remove();
                    break;
                }
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

class TypeWriter1 {

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

        switch (true) {

            case (areEpNode(range.startContainer, range.endContainer)):
                console.log(1000.1, 'areEpNode')
                break;

            case (areTextNode(range.startContainer, range.endContainer)):
                console.log(1000.2, 'areTextNode')

                let start = range.startContainer.parentElement;

                while (areStyleNode(start) || !start.contains(range.endContainer)) {
                    start = start.parentElement;
                }

                const iterator = document.createNodeIterator(start);

                let currentNode, offsetNode = range.startContainer;

                while ((currentNode = iterator.nextNode())) {
                    console.log(1000.21)
                    //offsetNode = currentNode;

                    if (!areEpNode(currentNode) && areEmpty(currentNode)) {
                        console.log(1000.211)
                        currentNode.remove();
                        //offsetNode = iterator.previousNode()
                    }

                    if (!areEpNode(currentNode) && areWordNode(currentNode, currentNode.previousElementSibling)) {
                        console.log(1000.212)
                        // offsetNode = iterator.previousNode()//offsetNode = currentNode.childNodes[0].firstChild//currentNode.previousElementSibling.lastChild
                        currentNode.previousElementSibling.append(...currentNode.childNodes);
                        currentNode.remove();
                    }
                }

                start.normalize();

                if (areEmpty(iterator.root)) {
                    console.log(1000.213)
                    document
                        .getSelection()
                        .collapse(iterator.root.nextSibling);
                    iterator.root.remove();
                } else {
                    console.log(1000.214, offsetNode)

                    if (areEpNode(offsetNode)) {
                        if (!!offsetNode.previousElementSibling) {
                            document
                                .getSelection()
                                .collapse(offsetNode.previousElementSibling);
                        } else {
                            document
                                .getSelection()
                                .collapse(offsetNode);
                        }
                    } else {
                        document
                            .getSelection()
                            .collapse(offsetNode);
                    }
                }

                break;
            default:
                console.log(1000.9, 'never')
        }
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

class TargetRange extends StaticRange {

    constructor(range) {
        console.table([range])

        let startContainer = range.startContainer,
            startOffset = range.startOffset,
            endContainer = range.endContainer,
            endOffset = range.endOffset,
            start = range.startContainer,
            currentNode;

        while (!!!startContainer.data) {
            startContainer = startContainer.firstChild;
            startOffset = 0;
        }

        while (!!!endContainer.data) {
            endContainer = endContainer.lastChild;
            endOffset = 0;
        }

        start = startContainer;

        while (!!start.data || !start.contains(endContainer) || areSpanNode(start)) {
            start = start.parentElement;
        }

        const iterator = document.createNodeIterator(start, NodeFilter.SHOW_TEXT),
            textnodes = [];

        while ((currentNode = iterator.nextNode())) {
            textnodes.push(currentNode)
        }

        textnodes.forEach((node, idx, arr) => {

            if (range.collapsed) {

                if (node === startContainer && startOffset == 0 && endOffset == 0) {

                    if (idx) {
                        startContainer = endContainer = arr[idx - 1];
                        startOffset = endOffset = startContainer.length;
                        return;
                    }
                }

            } else if (startContainer === endContainer) {
                console.log(1)
            } else {
                console.log(2)

                if (node === startContainer && startOffset === startContainer.length) {

                    if (idx < arr.length - 1) {
                        startContainer = arr[idx + 1];
                        startOffset = 0;
                    }
                }

                if (node === endContainer && endOffset == 0) {

                    if (idx) {
                        endContainer = arr[idx - 1];
                        endOffset = endContainer.length;
                    }
                    return;
                }
            }
        });

        super({
            startContainer: startContainer,
            endContainer: endContainer,
            startOffset: startOffset,
            endOffset: endOffset
        });
    }
}

class TypeWriter {

    constructor(node) {
        node.addEventListener('beforeinput', this);
        node.contentEditable = true;
    }

    handleEvent(event) {
        console.clear();
        event.preventDefault();
        //console.log(event)
        const [range] = event.getTargetRanges();

        const targetrange = new TargetRange(range);
        console.table([targetrange])
    }
}

class Writer {

    constructor(node) {

        const input = new TypeWriter(node);

        node.contentEditable = true;
    }
}

export { Writer, TypeWriter }