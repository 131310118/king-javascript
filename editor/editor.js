/**
 * Created by wangj on 2016/8/13.
 */

var KEStatus = {
    selection:undefined,
    range:undefined,
    list:[],//保存历史操作，用于撤销
    redoList:[],//保存撤销历史操作，用于恢复撤销
    emptyList:[],//用于去除上次操作产生的空节点
    status:{},//用于保存当前range选中的状态
    isKEMCDown:false,//焦点是否位于编辑区内
    //恢复range
    setFocus:function(){
        kEMain.focus();
        KEStatus.range.setStart(KEStatus.range.startContainer,KEStatus.range.startOffset);
        KEStatus.range.setEnd(KEStatus.range.endContainer,KEStatus.range.endOffset);
        KEStatus.select();
    },
    //保存range
    saveCusorPos:function(){
        KEStatus.selection = window.getSelection?window.getSelection():document.selection;
        KEStatus.range = KEStatus.selection.createRange?KEStatus.selection.createRange():KEStatus.selection.getRangeAt(0);
    },
    //选中range
    select:function(){
        KEStatus.selection.removeAllRanges();
        KEStatus.selection.addRange(KEStatus.range);
    },
    //命令入口
    execCommand:function(command){
        if(!KEStatus.range){
            kEMain.focus();
            KEStatus.saveCusorPos();
        }
        var l = [];
        while(KEStatus.emptyList.length){
            obj = KEStatus.emptyList.pop();
            if(obj!=KEStatus.range.commonAncestorContainer){
                if(obj.childNodes&&obj.childNodes.length==1&&obj.childNodes[0].nodeType==3&&obj.childNodes[0].length==1){
                    obj.parentNode&&obj.parentNode.removeChild(obj);
                }else if(obj.nodeType==3&&(obj.data=="​"||obj.data=='')){
                    obj.parentNode&&obj.parentNode.removeChild(obj);
                }else if(obj.childNodes&&obj.childNodes.length&&obj.childNodes[0].nodeType==3&&obj.childNodes[0].length>1){
                    if(obj.childNodes[0]!=KEStatus.range.commonAncestorContainer){
                        obj.childNodes[0].data = obj.childNodes[0].data.replace("​",'');
                    }else{
                        l.push(obj);
                    }
                }else if(obj.nodeType==3){
                    obj.data = obj.data.replace("​",'');
                }
            }
        }
        KEStatus.emptyList = l;
        KECommands['save']();
        KECommands[command]();
        KEStatus.initTools();
    },
    //去除子节点相同的节点
    mergeChild:function(element,tagName,option){
        var tags = element.getElementsByTagName(tagName),child,nodes = [];
        for(var i=0;i<tags.length;i++){
            nodes[i] = tags[i];
        }
        if(option){
            for(var i=0;i<nodes.length;i++){
                if(!KEStatus.compare(option,nodes[i])){
                    nodes.splice(i,1);
                    i--;
                }
            }
        }
        for(var i=0,j=nodes.length;i<j;i++){
            while(child = nodes[i].firstChild){
                nodes[i].parentNode.insertBefore(child,nodes[i]);
            }
            nodes[i].parentNode.removeChild(nodes[i]);
        }
    },
    //合并前后相同的节点
    mergeParent:function(element){
        var prev = element.previousSibling,next = element.nextSibling,
            i,child = element.firstChild,parent = element.parentNode;
        merge(prev,1);
        merge(next,2);
        function merge(ele,type){
            while(ele&&ele.nodeType==3&&(ele.data==''||ele.data=="​")){
                if(type==1){
                    ele = ele.previousSibling;
                    if(ele){
                        ele.parentNode.removeChild(ele.nextSibling);
                    }
                }else{
                    ele = ele.nextSibling;
                    if(ele){
                        ele.parentNode.removeChild(ele.previousSibling);
                    }
                }
            }
            if(ele&&ele.nodeName==element.nodeName){
                while(ele.childNodes.length){
                    if(type==1){
                        element.insertBefore(ele.childNodes[0],child);
                    }else{
                        element.appendChild(ele.childNodes[0]);
                    }
                }
                parent.removeChild(ele);
            }
        }
    },
    //获取range的递归最后节点
    getRangeEndContainer:function(b){
        while(b.lastChild){
            b = b.lastChild;
        }
        return b;
    },
    //获取range的递归起始节点
    getRangeStartContainer:function(b){
        while(b.firstChild){
            b = b.firstChild;
        }
        return b;
    },
    //去除前后空白节点
    mergeEmpty:function(b){
        while(b.previousSibling&& b.previousSibling.nodeType==3&& (b.previousSibling.data=="​"||b.previousSibling.data=='')){
            b.parentNode.removeChild(b.previousSibling)
        };
        while(b.nextSibling&& b.nextSibling.nodeType==3&& (b.nextSibling.data=="​"||b.nextSibling.data=='')){
            b.parentNode.removeChild(b.nextSibling);
        }
    },
    //初始化工具栏
    initTools:function(){
        setTools('isBold','B',kETool_b);
        setTools('isItalic','I',kETool_i);
        setTools('isUnderline','U',kETool_u);
        setTools('isBorder','SPAN',kETool_border,{style:{border:'1px solid rgb(0, 0, 0)'}});
        var s = KEStatus.range.startContainer,e = KEStatus.range.endContainer;
        while(s.parentNode!=kEMainContent){
            s = s.parentNode;
        }
        while(e.parentNode!=kEMainContent){
            e = e.parentNode;
        }
        if(s!=e){
            KEStatus.isMultiLine = {
                start:s,
                end:e
            };
        }else{
            KEStatus.isMultiLine = false;
        }
        function setTools(status,nodeName,element,option){//状态，节点标签，节点
            var node = KEStatus.range.startContainer;
            while(node!=kEMainContent){
                if(node.nodeName==nodeName){
                    if(option){
                       if(KEStatus.compare(option,node)){
                           break;
                       }
                    }else{
                        break;
                    }
                }
                node = node.parentNode;
            }
            if(node==kEMainContent){
                KEStatus.status[status] = {status:false};
                element.className = 'kETool_btn kETool_bg';
            }else{
                element.className = 'kETool_btn kETool_bg checked';
                KEStatus.status[status] = {status:true,node:node};
            }
        }
    },
    //保存工作
    saveWork:function(arr){
        arr.push({
            content:kEMainContent.innerHTML.trim(),
            range:(function(){
                var start = [],end = [];
                start.push(KEStatus.range.startOffset);
                end.push(KEStatus.range.endOffset);
                rangeMap(start,KEStatus.range.startContainer);
                rangeMap(end,KEStatus.range.endContainer);
                function rangeMap(array,element){
                    var parent = element;
                    while(parent!=kEMainContent){
                        var i=0;
                        var prev = parent.previousSibling;
                        while(prev){
                            i++;
                            prev = prev.previousSibling;
                        }
                        array.push(i);
                        parent = parent.parentNode;
                    }
                }
                return {
                    start:start,
                    end:end
                }
            })()
        });
    },
    //还原工作
    setWork:function(arr){
        var last = arr.pop();
        kEMainContent.innerHTML = last.content;
        !function(){
            var s = unrangeMap(last.range.start);
            var e = unrangeMap(last.range.end);
            KEStatus.range.setStart(s.container, s.start);
            KEStatus.range.setEnd(e.container, e.start);
            function unrangeMap(array){
                var root = kEMainContent,container;
                for(var i=array.length-1;i>0;i--){
                    container = root.childNodes[array[i]];
                    root = container;
                }
                return {
                    start:array[0],
                    container:container
                }
            }
        }();
        KEStatus.select();
    },
    compare:function(inputValue,outputValue){
        for(var key in inputValue) {
            if (inputValue[key] && inputValue[key].constructor == Object) {
                if(!KEStatus.compare(inputValue[key], outputValue[key])){
                    return false;
                }
            }
            else if (inputValue[key] != outputValue[key]) {
                return false
            }
        }
        return true;
    },
    updateObject:function (inputValue,outputValue){
        for(var key in inputValue) {
            if (inputValue[key] && inputValue[key].constructor == Object) {
                KEStatus.updateObject(inputValue[key], outputValue[key]);
            }
            else if (inputValue[key] != undefined) {
                outputValue[key] = inputValue[key];
            }
        }
        return outputValue;
    }
};
var KECommands = {
    execCommandTag:function(status,nodeName,option){
        if(!KEStatus.isMultiLine){
            var b,obj,ec,range;
            if(!KEStatus.status[status].status){
                b = tag(nodeName,option);
                if(KEStatus.range.collapsed){
                    KEStatus.range.insertNode(b);
                    b.innerHTML = '&#8203;';
                    KEStatus.emptyList.push(b);
                    KEStatus.range.setEnd(b, 1);
                    KEStatus.range.collapse(false);
                    KEStatus.select();
                }else{
                    b.appendChild(KEStatus.range.extractContents());
                    KEStatus.mergeChild(b,nodeName,option);
                    KEStatus.range.insertNode(b);
                    KEStatus.mergeEmpty(b);
                    KEStatus.range.setStart(KEStatus.getRangeStartContainer(b), 0);
                    obj = KEStatus.getRangeEndContainer(b);
                    KEStatus.range.setEnd(obj,obj.length);
                    KEStatus.select();
                    KEStatus.mergeParent(b);
                }
            }else{
                var node = KEStatus.status[status].node;
                //截取前半部分-start
                range = KEStatus.range.cloneRange();
                while(true){
                    if(range.startContainer.nodeType==3){
                        if(range.startOffset==0||(range.startOffset==1&&range.startContainer.data[0]=='')){
                            range.setStartBefore(range.startContainer);
                        }else{
                            break;
                        }
                    }else{
                        if(range.startOffset==0){
                            range.setStartBefore(range.startContainer);
                        }else{
                            break;
                        }
                    }
                }
                range.collapse(true);
                range.setStart(node,0);
                b = tag(nodeName,option);
                b.appendChild(range.extractContents());
                if((b.childNodes.length&&b.childNodes[0].data=="​") || !b.childNodes.length){
                }else{
                    node.parentNode.insertBefore(b,node);
                }
                //截取前半部分-end
                //截取中间部分-start
                range = KEStatus.range.cloneRange();
                while(range.startContainer!=node&&range.endContainer!=range.commonAncestorContainer){
                    if(range.startContainer.nodeType==3){
                        if(range.startOffset==0||(range.startOffset==1&&range.startContainer.data[0]=='')){
                            range.setStartBefore(range.startContainer);
                        }else{
                            break;
                        }
                    }else{
                        if(range.startOffset==0){
                            range.setStartBefore(range.startContainer);
                        }else{
                            break;
                        }
                    }
                }
                while(range.endContainer!=node&&range.endContainer!=range.commonAncestorContainer){
                    if(range.endContainer.nodeType==3) {
                        if(range.endContainer.length==range.endOffset){
                            range.setEndAfter(range.endContainer);
                        }else{
                            break;
                        }
                    }else{
                        if(range.endContainer.childNodes.length==range.endOffset){
                            range.setEndAfter(range.endContainer);
                        }else{
                            break;
                        }
                    }
                }
                if(KEStatus.range.collapsed){
                    ec = tag(nodeName,option);
                    ec.innerHTML = '&#8203;';
                    range.setStart(ec,0);
                    range.setEnd(ec,1);
                    ec = range.extractContents();
                    node.parentNode.insertBefore(ec,node);
                    KEStatus.emptyList.push(node.previousSibling);
                    KEStatus.range.setEnd(node.previousSibling,1);
                    if(node.previousSibling.previousSibling&&node.previousSibling.previousSibling.nodeType==3){
                        KEStatus.range.setStartBefore(node.previousSibling);
                        KEStatus.range.collapse(true);
                        node.parentNode.removeChild(node.previousSibling);
                    }
                    KEStatus.range.collapse(false);
                    KEStatus.select();
                }else{
                    ec = range.extractContents();
                    b = tag(nodeName,option);
                    b.appendChild(ec);
                    KEStatus.mergeChild(b,nodeName,option);
                    range.setStart(b,0);
                    obj = KEStatus.getRangeEndContainer(b);
                    range.setEnd(obj,obj.length);
                    ec = range.extractContents();
                    obj = node.previousSibling;
                    node.parentNode.insertBefore(ec,node);
                    if(!obj){
                        obj = node.parentNode.firstChild;
                    }else{
                        obj = obj.nextSibling;
                    }
                    KEStatus.range.setStart(KEStatus.getRangeStartContainer(obj),0);
                    obj = KEStatus.getRangeEndContainer(node.previousSibling);
                    KEStatus.range.setEnd(obj,obj.length);
                    KEStatus.select();
                }
                //截取中间部分-end
                while(node.childNodes.length&&node.firstChild.nodeType==3&&(node.firstChild.data=="​"||node.firstChild.data=='')){
                    node.removeChild(node.firstChild);
                }
                if(!node.childNodes.length){
                    node.parentNode.removeChild(node);
                }
            }
        }else{
            var s = KEStatus.isMultiLine.start,e = KEStatus.isMultiLine.end;
            var b,obj,ec,range;
            if(!KEStatus.status[status].status){
                while(true){
                    var rg = KEStatus.range.cloneRange();
                    if(s!=KEStatus.isMultiLine.start){
                        rg.setStart(s,0);
                    }
                    if(s!=e){
                        rg.setEndAfter(s.lastChild);
                        b = tag(nodeName,option);
                        b.appendChild(rg.extractContents());
                        KEStatus.mergeChild(b,nodeName,option);
                        rg.insertNode(b);
                        KEStatus.mergeEmpty(b);
                        if(s==KEStatus.isMultiLine.start){
                            KEStatus.range.setStart(KEStatus.getRangeStartContainer(b), 0);
                            KEStatus.mergeParent(b);
                        }
                    }else{
                        b = tag(nodeName,option);
                        b.appendChild(rg.extractContents());
                        KEStatus.mergeChild(b,nodeName,option);
                        rg.insertNode(b);
                        KEStatus.mergeEmpty(b);
                        KEStatus.range.setEndAfter(b.lastChild);
                        break;
                    }
                    s = s.nextSibling;
                }
                KEStatus.select();
            }else{
                while(true) {
                    var rg = KEStatus.range.cloneRange();
                    if(s==KEStatus.isMultiLine.start){
                        var node = KEStatus.status[status].node;
                        //截取前半部分-start
                        range = rg.cloneRange();
                        while (true) {
                            if (range.startContainer.nodeType == 3) {
                                if (range.startOffset == 0 || (range.startOffset == 1 && range.startContainer.data[0] == '')) {
                                    range.setStartBefore(range.startContainer);
                                } else {
                                    break;
                                }
                            } else {
                                if (range.startOffset == 0) {
                                    range.setStartBefore(range.startContainer);
                                } else {
                                    break;
                                }
                            }
                        }
                        range.collapse(true);
                        range.setStart(node, 0);
                        b = tag(nodeName, option);
                        b.appendChild(range.extractContents());
                        if ((b.childNodes.length && b.childNodes[0].data == "​") || !b.childNodes.length) {
                        } else {
                            node.parentNode.insertBefore(b, node);
                        }
                        //截取前半部分-end
                        //截取中间部分-start
                        range = rg.cloneRange();
                        while (range.startContainer != node && range.endContainer != range.commonAncestorContainer) {
                            if (range.startContainer.nodeType == 3) {
                                if (range.startOffset == 0 || (range.startOffset == 1 && range.startContainer.data[0] == '')) {
                                    range.setStartBefore(range.startContainer);
                                } else {
                                    break;
                                }
                            } else {
                                if (range.startOffset == 0) {
                                    range.setStartBefore(range.startContainer);
                                } else {
                                    break;
                                }
                            }
                        }
                        while (range.endContainer != node && range.endContainer != range.commonAncestorContainer) {
                            if (range.endContainer.nodeType == 3) {
                                if (range.endContainer.length == range.endOffset) {
                                    range.setEndAfter(range.endContainer);
                                } else {
                                    break;
                                }
                            } else {
                                if (range.endContainer.childNodes.length == range.endOffset) {
                                    range.setEndAfter(range.endContainer);
                                } else {
                                    break;
                                }
                            }
                        }
                        if (rg.collapsed) {
                            ec = tag(nodeName, option);
                            ec.innerHTML = '&#8203;';
                            range.setStart(ec, 0);
                            range.setEnd(ec, 1);
                            ec = range.extractContents();
                            node.parentNode.insertBefore(ec, node);
                            KEStatus.emptyList.push(node.previousSibling);
                            rg.setEnd(node.previousSibling, 1);
                            if (node.previousSibling.previousSibling && node.previousSibling.previousSibling.nodeType == 3) {
                                rg.setStartBefore(node.previousSibling);
                                rg.collapse(true);
                                node.parentNode.removeChild(node.previousSibling);
                            }
                            rg.collapse(false);
                            KEStatus.select();
                        } else {
                            ec = range.extractContents();
                            b = tag(nodeName, option);
                            b.appendChild(ec);
                            KEStatus.mergeChild(b, nodeName, option);
                            range.setStart(b, 0);
                            obj = KEStatus.getRangeEndContainer(b);
                            range.setEnd(obj, obj.length);
                            ec = range.extractContents();
                            obj = node.previousSibling;
                            node.parentNode.insertBefore(ec, node);
                            if (!obj) {
                                obj = node.parentNode.firstChild;
                            } else {
                                obj = obj.nextSibling;
                            }
                            rg.setStart(KEStatus.getRangeStartContainer(obj), 0);
                            obj = KEStatus.getRangeEndContainer(node.previousSibling);
                            rg.setEnd(obj, obj.length);
                            KEStatus.select();
                        }
                        //截取中间部分-end
                        while (node.childNodes.length && node.firstChild.nodeType == 3 && (node.firstChild.data == "​" || node.firstChild.data == '')) {
                            node.removeChild(node.firstChild);
                        }
                        if (!node.childNodes.length) {
                            node.parentNode.removeChild(node);
                        }
                    }else if(s!=e){
                        rg.setStart(s,0);
                        rg.setEndAfter(s.lastChild);
                        b = tag(nodeName,option);
                        b.appendChild(rg.extractContents());
                        KEStatus.mergeChild(b,nodeName,option);
                        rg.insertNode(b);
                        KEStatus.mergeEmpty(b);
                    }else{
                        rg.setStart(s,0);
                        b = tag(nodeName,option);
                        b.appendChild(rg.extractContents());
                        KEStatus.mergeChild(b,nodeName,option);
                        rg.insertNode(b);
                        KEStatus.mergeEmpty(b);
                    }
                }
            }
        }
        function tag(nodeName,option){
            var ele = document.createElement(nodeName);
            if(option){
                KEStatus.updateObject(option,ele);
            }
            return ele;
        }
    },
    Bold:function(){
        KECommands.execCommandTag('isBold','b');
    },
    Italic:function(){
        KECommands.execCommandTag('isItalic','i');
    },
    Underline:function(){
        KECommands.execCommandTag('isUnderline','u');
    },
    Border:function(){
        KECommands.execCommandTag('isBorder','span',{style:{border:'1px solid rgb(0, 0, 0)'}});
    },
    save:function(){
        KEStatus.redoList = [];
        KEStatus.saveWork(KEStatus.list);
    },
    undo:function(){
        if(KEStatus.list.length){
            KEStatus.saveWork(KEStatus.redoList);
            KEStatus.setWork(KEStatus.list);
        }
    },
    redo:function(){
        if(KEStatus.redoList.length){
            KEStatus.saveWork(KEStatus.list);
            KEStatus.setWork(KEStatus.redoList);
        }
    }
};

//记录用户选中-start
kEMainContent.onmousedown = function(){
    KEStatus.isKEMCDown = true;
};
kEMainContent.onmouseup = function(){
    if(KEStatus.isKEMCDown){
        KEStatus.saveCusorPos();
        KEStatus.initTools();
    }
};
document.onmouseup = function(e){
    if(KEStatus.isImgDown){
        KEStatus.isImgDown = false;
    }
}
kEMain.onblur = function(){
    KEStatus.isKEMCDown = false;
    KEStatus.saveCusorPos();
    KEStatus.initTools();
};
//记录用户选中-end
//内容为空无法删除-start
kEMain.addEventListener('keydown',function(e){
    if(e.keyCode==8){
        if(kEMainContent.childNodes[0].innerHTML=='<br>'){
            e.preventDefault();
            e.stopPropagation();
        }
    }else if(e.keyCode==90){
        event.preventDefault();
        KECommands['undo']();
    }else if(e.keyCode==89){
        event.preventDefault();
        KECommands['redo']();
    }
});
//内容为空无法删除-end
kEMain.addEventListener('keyup',function(){
    KEStatus.saveCusorPos();
    KEStatus.initTools();
})
kETools.onclick = function(e){
    switch(e.target.id) {
        case 'kETool_b':
            KEStatus.execCommand( 'Bold');
            break;
        case 'kETool_i':
            KEStatus.execCommand( 'Italic');
            break;
        case 'kETool_u':
            KEStatus.execCommand( 'Underline');
            break;
        case 'kETool_border':
            KEStatus.execCommand( 'Border');
            break;
    }
};
kETool_img.addEventListener('change',function(){
    if(!KEStatus.range){
        kEMain.focus();
        KEStatus.saveCusorPos();
    }
    KEStatus.setFocus();
    var img = document.createElement('img');
    var st = KEStatus.selection;
    var r = KEStatus.range;
    var s = function(e){
        event.stopPropagation();
    };
    var n = function(){
        focusImg.style.display = 'none';
        KEStatus.modifyImg = undefined;
        KEStatus.selection = st;
        KEStatus.range = r;
        KEStatus.setFocus();
    };
    img.setAttribute('id','image');
    KEStatus.range.insertNode(img);
    KEStatus.range.setStartAfter(img);
    KEStatus.range.setEndAfter(img);
    var st = KEStatus.selection;
    var r = KEStatus.range;
    //document.execCommand("inserthtml",'<img src=\"\" id=\"load\"/>');
    //KEStatus.saveCusorPos();
    //me.execCommand('inserthtml', '<img class="loadingclass" id="' + loadingId + '" src="' + me.options.themePath + me.options.theme +'/images/spacer.gif" title="' + (me.getLang('simpleupload.loading') || '') + '" >');
    if(typeof FileReader != 'undefined'){
        var acceptedTypes = {
            'image/png':true,
            'image/jpeg':true,
            'image/gif':true
        };
        if(acceptedTypes[document.getElementById('kETool_img').files[0].type] === true){
            var reader = new FileReader();
            reader.onload = function(event){
                img.setAttribute('src',event.target.result);
                img.onclick = function(){
                    KEStatus.range.selectNode(img);
                    KEStatus.modifyImg = img;
                    KEStatus.setFocus();
                    modifyImg.removeEventListener('click',s);
                    focusImg.removeEventListener('click',n);
                    modifyImg.style.left = img.offsetLeft+'px';
                    modifyImg.style.top = (img.offsetTop-kEMainContent.scrollTop)+'px';
                    modifyImg.style.width = img.clientWidth+'px';
                    modifyImg.style.height = img.clientHeight+'px';
                    focusImg.style.display = 'block';
                    modifyImg.addEventListener('click',s);
                    focusImg.addEventListener('click',n);
                };
                img.removeAttribute('id');
                KEStatus.setFocus();
            };
            reader.readAsDataURL(document.getElementById('kETool_img').files[0]);
        }
    }
});
modifyImg.addEventListener('mousedown',function(e){
    KEStatus.isImgDown = true;
    KEStatus.modifyTarget = e.target;
});
document.body.addEventListener('mousemove',function(e){
    if(!KEStatus.isImgDown){
        return;
    }
    var setPosition = function(){
        modifyImg.style.left = KEStatus.modifyImg.offsetLeft+'px';
        modifyImg.style.top = KEStatus.modifyImg.offsetTop-kEMainContent.scrollTop+'px';
        modifyImg.style.width = KEStatus.modifyImg.clientWidth+'px';
        modifyImg.style.height = KEStatus.modifyImg.clientHeight+'px';
    };
    var x = modifyImg.style.width.substring(0,modifyImg.style.width.length-2);
    var y = modifyImg.style.height.substring(0,modifyImg.style.height.length-2);
    if(KEStatus.modifyTarget.getAttribute('id')=='modifyImg_lt'){
        KEStatus.modifyImg.style.width = x-e.movementX+'px';
        KEStatus.modifyImg.style.height = y-e.movementY+'px';
        setPosition();
    }
    else if(KEStatus.modifyTarget.getAttribute('id')=='modifyImg_mt'){
        KEStatus.modifyImg.style.width = x+'px';
        KEStatus.modifyImg.style.height = y-e.movementY+'px';
        setPosition();
    }
    else if(KEStatus.modifyTarget.getAttribute('id')=='modifyImg_rt'){
        KEStatus.modifyImg.style.width = x*1+e.movementX+'px';
        KEStatus.modifyImg.style.height = y-e.movementY+'px';
        setPosition();
    }
    else if(KEStatus.modifyTarget.getAttribute('id')=='modifyImg_lm'){
        KEStatus.modifyImg.style.width = x-e.movementX+'px';
        KEStatus.modifyImg.style.height = y+'px';
        setPosition();
    }
    else if(KEStatus.modifyTarget.getAttribute('id')=='modifyImg_rm'){
        KEStatus.modifyImg.style.width = x*1+e.movementX+'px';
        KEStatus.modifyImg.style.height = y+'px';
        setPosition();
    }
    else if(KEStatus.modifyTarget.getAttribute('id')=='modifyImg_lb'){
        KEStatus.modifyImg.style.width = x-e.movementX+'px';
        KEStatus.modifyImg.style.height = y*1+e.movementY+'px';
        setPosition();
    }
    else if(KEStatus.modifyTarget.getAttribute('id')=='modifyImg_mb'){
        KEStatus.modifyImg.style.width = x+'px';
        KEStatus.modifyImg.style.height = y*1+e.movementY+'px';
        setPosition();
    }
    else if(KEStatus.modifyTarget.getAttribute('id')=='modifyImg_rb'){
        KEStatus.modifyImg.style.width = x*1+e.movementX+'px';
        KEStatus.modifyImg.style.height = y*1+e.movementY+'px';
        setPosition();
    }
});