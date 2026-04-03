

class Selection {

    constructor(node) {
        this.node = node;

        document.addEventListener("selectionchange", this, { once: true });
    }

    handleEvent(event) {

        const selection = document.getSelection();

        const bit = (selection.anchorNode.compareDocumentPosition(selection.focusNode)
            & Node.DOCUMENT_POSITION_FOLLOWING);

        const [startNode, endNode] = (bit === 4)
            ? [selection.focusNode, selection.anchorNode]
            : [selection.anchorNode, selection.focusNode];


        //        const first = document.createExpression("(.//span)[1]");
        //        const last = document.createExpression("(.//span[not(@class='br')])[last()]");

        const first = document.evaluate(
            "(.//span)[1]/text()",
            startNode,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null,
        );

        const last = document.evaluate(
            "(.//span[not(@class='br')])[last()]",
            endNode,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null,
        );

        console.log(startNode, endNode, first.singleNodeValue, last.singleNodeValue)
        if (selection.anchorNode === this.node) {
            const range = new Range();
            range.setStartBefore(first.singleNodeValue);
            range.setEndAfter(last.singleNodeValue);
            //document.removeEventListener("selectionchange", this);
            //selection.setBaseAndExtent(first.singleNodeValue, 0, last.singleNodeValue, 1);
            selection.addRange(range);
        }
        setTimeout(() => {
            document.addEventListener("selectionchange", this, { once: true });
        }, 500)
    }
}

class Observer extends MutationObserver {

    constructor(node) {

        const options = {
            subtree: true,
            childList: true,
            characterDataOldValue: true
        }

        super((mutationList, observer) => {

            mutationList.push(...observer.takeRecords());

            this.disconnect();

            for (const mutation of mutationList) {

                switch (mutation.type) {
                    case 'characterData':
                        //console.log(mutation)
                        break;
                }
            }

            this.observe(node, options);
        })

        this.observe(node, options);
    }
}

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
        default:
            elem.className = 'w';
    }
    return elem;
}

class Input {

    constructor(node) {

        node.addEventListener('beforeinput', this);
    }

    handleEvent(event) {
        // console.log(event)

        event.preventDefault();

        const [range] = event.getTargetRanges();

        console.log(range)

        let startText = range.startContainer;
        let startOffset = range.startOffset;

        if (startText.nodeType === Node.ELEMENT_NODE) {
            startText = evaluateXPath(range.startContainer, `
                ((.//span[not(@class="br")])[1])/text()
            `);
        }

        let endText = range.endContainer;
        let endOffset = range.endOffset;

        if (endText.nodeType === Node.ELEMENT_NODE) {
            endText = evaluateXPath(range.endContainer, `
                ((.//span[not(@class="br")])[last()])/text() |
                ((..//span[not(@class="br")])[last()])/text()
            `);
        }

        console.log(startText, endText)
        if (!(startText && endText)) {
            //return; /* firefox? */
        }

        switch (true) {
            case (startText === null && endText === null):
                if (range.startContainer === range.endContainer) {
                    const br = evaluateXPath(range.startContainer, `
                        ((.//span[@class="br"])[1]) |
                        ((..//span[@class="br"])[1])
                    `);
                    const span = createSpan('');
                    br.before(span);

                    startText = endText = span.firstChild;
                    startOffset = endOffset = 0;
                } else {
                    console.info('TODO 1')
                }
                break;
            case (startText === null): // endContainer = span.br
                    //console.info('TODO 2', range.startContainer, range.startContainer === range.endContainer)
                    startText = endText;
                break;

            case (endText === null):
                    console.info('TODO 3')
                break;

            default:
                console.info(startText, startOffset, endText, endOffset)
        }

        const startNode = startText.parentElement;
        const endNode = endText.parentElement;

        if (startNode !== endNode) {
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

        const pre = startText?.data?.slice(0, startOffset);
        const post = endText?.data?.slice(endOffset);

        switch (event.inputType) {
            case 'insertText':
                return this.onInsertText(startNode, endNode, pre, post, event.data);

            case 'deleteContentBackward':
                return this.onDeleteContent(startNode, endNode, pre, post);

            default:
                console.log(event.inputType)
        }
    }

    onDeleteContent(startNode, endNode, pre, post) {
        console.debug('onDeleteContent', {
            startNode: startNode,
            endNode: endNode,
            equal: startNode === endNode,
            pre: pre,
            post: post
        });

        if (startNode === endNode) {
            switch (startNode.className) {
                case 'br':
                   break// return;
                default:
                    startNode.innerText = pre + post;
            }

            if (startNode.innerText) {
                console.log(1)
                document
                    .getSelection()
                    .collapse(startNode.firstChild, pre.length);

            } else {
                console.log(2, startNode.nextElementSibling)
                document
                    .getSelection()
                    .collapse(
                        startNode.nextElementSibling.className==='br'
                        ? startNode.nextElementSibling
                        : startNode.nextElementSibling.firstChild
                    );
                startNode.remove();
            }
        } else {

        }
    }

    onInsertText(startNode, endNode, pre, post, data) {
        console.debug('onInsertText', {
            startNode: startNode,
            endNode: endNode,
            equal: startNode === endNode,
            pre: pre,
            post: post
        });

        if (startNode === endNode) {
            switch (startNode.className) {
                case 'br': {
                    const span = createSpan(data);
                    startNode
                        .before(span);
                    document
                        .getSelection()
                        .collapse(span.firstChild, span.innerText.length);
                    break;
                }

                case 'sp': {
                    const span = createSpan(data);
                    // Cursor vor oder nach dem Leerzeichen
                    if (post.length) { // vor
                        startNode.before(span);
                    } else { // nach
                        startNode.after(span);
                    }
                    document
                        .getSelection()
                        .collapse(span.firstChild, 1)
                    break;
                }

                default:
                    if ([' '].includes(data)) {
                        const sp = createSpan(data);

                        if (pre) {
                            startNode.innerText = pre;
                            startNode.after(sp);
                        } else {
                            startNode.replaceWith(sp);
                        }

                        if (post) {
                            const span = createSpan(post);
                            sp.after(span);
                        }

                        document
                            .getSelection()
                            .collapse(sp.firstChild, 1);

                    } else {
                        startNode.innerText = `${pre}${data}${post}`;
                        document
                            .getSelection()
                            .collapse(startNode.firstChild, pre.length + data.length);
                    }
                    break;
            }
        } else {
            console.info('TODO: startNode !== endNode')
        }
    }
}

class Writer {

    constructor(node) {

        const input = new Input(node);
        //const observer = new Observer(node);
        //const selection = new Selection(node);

        node.contentEditable = true;
        //node.innerHTML = '<article><p><span class="w">aaa</span><span class="br"><br></span></p><p><span class="w2">b</span><span class="br"><br></span></p></article>';
        node.innerHTML = '<article><p><span class="br"><br></span></p></article>'
        //node.innerHTML = '<article><p><span class="w">a</span><span class="sp"> </span><span class="w">b</span><span class="sp"> </span><span class="w">c</span><span class="br"><br></span></p></article>'
        //node.innerHTML = '<article><p><span class="w">ab<span style="color: red">cd</span></span><span class="br"><br></span></p></article>'
        //node.innerHTML = '<article><p><span class="w">a</span><span class="sp"> </span><span class="w">b</span><span class="br"><br></span></p><p><span class="w">c</span><span class="sp"> </span><span class="w">d</span><span class="br"><br></span></p></article>';

    }
}

export { Writer }