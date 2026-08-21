if getParameter("eventId") ~= nil then 
    assert(Interface ~= nil)
    local eventId = tonumber(getParameter("eventId"))
    Interface.events[eventId]()
    return 0
end

Interface = {}
Interface.__index = Interface
Interface.events = {}
Interface.eventId = 1

-- 设置界面激活状态
function Interface:activate(visible) root.interface[self.id].active = visible; return self end

-- 创建图像资源
function Interface:addImage(url) local tId = root.interface[self.id].content.texture.f_create(1,url,false,false,false); return root.interface[self.id].content.image.f_create(tId,url) end

-- 创建音频资源
function Interface:addSound(url) local sId = root.interface[self.id].sound.content.f_create(nil); root.interface[self.id].sound.content[sId].url = url; root.interface[self.id].sound.f_playSound(sId, 0); return sId end

-- 触发音频播放
function Interface:playSound(soundId, volume) root.interface[self.id].sound.f_playSound(soundId, volume); return self end

-- 获取指定节点
function Interface:getNode(nodeId) return root.interface[self.id].nodes[nodeId] end

Widget = {}
Widget.__index = Widget

-- 实例化基础控件
function Widget:new() local o = {}; setmetatable(o, self); o.id = 1919191919191; return o end

-- 控制可见性
function Widget:setVisible(visible) self:getNode().visible = visible; return self end

-- 获取控件对应节点
function Widget:getNode() return self.interface:getNode(self.id) end

-- 设定控件边界
function Widget:setBounds(left,top,width,height)
    local node = self:getNode(); node.sizeX = width; node.sizeY = height
    node.f_setHorizontalAlign(1); node.f_setVerticalAlign(1)
    node.localLeft = left; node.localTop = top; return self
end

-- 设定控件尺寸
function Widget:setSize(width,height) local node = self:getNode(); node.sizeX = width; node.sizeY = height; return self end

-- 设置水平居中
function Widget:centerHorizontal() local node = self:getNode(); node.f_setHorizontalAlign(2); return self end

-- 设置垂直居中
function Widget:centerVertical() local node = self:getNode(); node.f_setVerticalAlign(2); return self end

Root = Widget:new()
Root.__index = Root

-- 绑定根节点
function Root:use(interface) local o = Widget:new(); o.interface = interface; o.id = 0; return o end

-- 绑定界面实例
function Interface:use(name)
    local o = {}; setmetatable(o, self); o.id = 0
    while true do
        if root.interface[o.id] == nil then o.id=-1; break end
        if root.interface[o.id].name == name then break end
        o.id = o.id + 1
    end
    assert(o.id >= 0); return o
end

-- 绑定系统快捷键
function Interface:bindHotKey(keys,handlerText)
    local handler = root.interface[self.id].scripts.storage.f_create(nil)
    root.interface[self.id].scripts.f_reinit(handler,handlerText)
    local hk = root.interface[self.id].hotKeys.list.f_create();
    for keyIdx = 1, #keys do local i = root.interface[self.id].hotKeys.list[hk].keys.f_create(); root.interface[self.id].hotKeys.list[hk].keys[i].value = keys[keyIdx] end
    local sId = root.interface[self.id].hotKeyScripts.f_create(hk)
    root.interface[self.id].hotKeyScripts[sId].script = handler; return self
end

-- 绑定控件按键事件
function Interface:bindKeyPress(widget,keys,handlerText)
    local handler = root.interface[self.id].scripts.storage.f_create(nil)
    root.interface[self.id].scripts.f_reinit(handler,handlerText)
    root.interface[self.id].guiScripts.f_create(widget.id,1,handler,"eventId="..Interface.eventId,key);
    Interface.events[Interface.eventId] = handler; Interface.eventId = Interface.eventId + 1; return self
end

Panel = Widget:new()
Panel.__index = Panel

-- 实例化面板
function Panel:new(parent,color)
    local o = setmetatable(Widget:new(), Panel); o.id=parent:getNode().children.f_create("panel")
    o.interface = parent.interface; local node = o:getNode(); node.widget.color.value = color; return o
end

-- 设定面板颜色
function Panel:setColor(color) local node = self:getNode(); node.widget.color.value = color; return self end

Image = Widget:new()
Image.__index = Image

-- 实例化图像
function Image:new(parent,color)
    local o = setmetatable(Widget:new(), Image); o.id=parent:getNode().children.f_create("dynamicImage")
    o.interface = parent.interface; local node = o:getNode(); node.widget.alternativeColor.value = color; return o
end

-- 设置不同状态的外观属性
function Image:setAppearance(normalId,normalColor,pressedId,pressedColor,hoveredId,hoveredColor,disabledId,disabledColor)
    local node = self:getNode(); node.widget.set.normal = normalId; node.widget.set.normalColor.value = normalColor; node.widget.set.pressed = pressedId; node.widget.set.pressedColor.value = pressedColor; node.widget.set.hovered = hoveredId; node.widget.set.hoveredColor.value = hoveredColor; node.widget.set.disabled = disabledId; node.widget.set.disabledColor.value = disabledColor; return self
end

-- 统一设置图像纹理
function Image:setImage(imageId,color) self:setAppearance(imageId,color,imageId,color,imageId,color,imageId,color); return self end

Label = Widget:new()
Label.__index = Label

-- 实例化文本
function Label:new(parent)
    local o = setmetatable(Widget:new(), Label); o.id=parent:getNode().children.f_create("text"); o.interface = parent.interface; return o
end

-- 设定字体排版属性
function Label:setFont(name,size,color) local node = self:getNode(); node.widget.font.name = name; node.widget.font.size = size; node.widget.textColor.value = color; return self end

-- 赋予文本内容
function Label:setText(text) local node = self:getNode(); node.widget.text = text; return self end

-- 附加文本组件
function Widget:addLabel() return Label:new(self) end

-- 附加图像组件
function Widget:addImage() return Image:new(self,0xffffffff) end

-- 附加面板组件
function Widget:addPanel() return Panel:new(self,0xffffffff) end