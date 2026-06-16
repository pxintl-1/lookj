// 全局狀態變數
let otherProfile = { name: '小鳥丸', imgData: null };
let myProfile = { name: '晴時雨', imgData: null };
let chatHistory = [];
let replySpeedConfig = { min: 2, max: 5 };
let allowInitiativeMessage = false;
let maxInitiativeMinutes = 5; 
let cardDatabase = [{ id: 1, group: '預設分組', text: '系統連線已就緒。' }];

let callTimer = null, autoResponseTimeout = null, callSeconds = 0, isCallConnected = false; 
let initiativeCheckInterval = null, nextInitiativeTriggerTime = 0, isTyping = false; 

// 初始化事件監聽
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    updateAllUI();
    startInitiativeMonitor();
});

function initEventListeners() {
    // 頂欄控制
    document.getElementById('chatHeaderBar').addEventListener('click', openPrefPanel);
    document.getElementById('headerLeftArea').addEventListener('click', (e) => {
        e.stopPropagation();
        editOtherName();
    });
    document.getElementById('headerOtherAvatar').addEventListener('click', (e) => {
        e.stopPropagation();
        editOtherAvatar();
    });
    document.getElementById('headerRightArea').addEventListener('click', (e) => {
        e.stopPropagation();
        editMyName();
    });
    document.getElementById('headerMyAvatar').addEventListener('click', (e) => {
        e.stopPropagation();
        editMyAvatar();
    });

    // 頂欄頂部右側動作按鈕
    document.getElementById('configBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        openPrefPanel();
    });
    document.getElementById('themeBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTheme();
    });
    document.getElementById('callBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        startCallSession();
    });

    // 輸入框及發送
    document.getElementById('messageInput').addEventListener('keydown', (e) => {
        if (e.keyCode === 13) sendMessage();
    });
    document.getElementById('forceTriggerBtn').addEventListener('click', forceTriggerOtherMessage);
    document.getElementById('sendMsgBtn').addEventListener('click', sendMessage);

    // 設定面板切換
    document.getElementById('prefModalOverlay').addEventListener('click', closePrefPanel);
    document.getElementById('prefPanelContainer').addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('panelCloseBtn').addEventListener('click', closePrefPanel);

    // 面板菜單導航
    document.getElementById('navToCardManage').addEventListener('click', () => switchSegment('segmentCardManage', '字卡數據配置'));
    document.getElementById('navToChatAdjust').addEventListener('click', () => switchSegment('segmentChatAdjust', '聊天狀態調整'));
    document.getElementById('navToBgAdjust').addEventListener('click', () => switchSegment('segmentBgAdjust', '背景視窗調整'));

    // 返回按鈕
    document.getElementById('backToMenuFromCard').addEventListener('click', () => navigateToLayer('segmentMainMenu', '配置控制中心'));
    document.getElementById('backToMenuFromChat').addEventListener('click', () => navigateToLayer('segmentMainMenu', '配置控制中心'));
    document.getElementById('backToMenuFromBg').addEventListener('click', () => navigateToLayer('segmentMainMenu', '配置控制中心'));

    // 字卡管理操作
    document.getElementById('selectAllCardsBtn').addEventListener('click', () => selectAllCards(true));
    document.getElementById('deselectAllCardsBtn').addEventListener('click', () => selectAllCards(false));
    document.getElementById('deleteSelectedCardsBtn').addEventListener('click', deleteSelectedCards);
    document.getElementById('addNewGroupBtn').addEventListener('click', () => addNewGroup());
    document.getElementById('importTextarea').addEventListener('input', checkTextareaContent);
    document.getElementById('importJsonBtn').addEventListener('click', triggerJsonSelect);
    document.getElementById('injectBtn').addEventListener('click', injectIntoPool);

    // 聊天設定儲存與清除
    document.getElementById('allowInitiativeSwitch').addEventListener('change', toggleInitiativeSubfields);
    document.getElementById('saveChatAdjustBtn').addEventListener('click', saveChatAdjustSettings);
    document.getElementById('clearChatLogsBtn').addEventListener('click', clearChatLogs);

    // 背景調整
    document.getElementById('uploadBgBtn').addEventListener('click', triggerBgSelect);
    document.getElementById('resetBgBtn').addEventListener('click', resetBgImage);

    // 隱藏文件輸入變更
    document.getElementById('bgImageFileInput').addEventListener('change', handleBgImageSelect);
    document.getElementById('jsonFileInput').addEventListener('change', handleJsonImport);

    // 掛斷電話
    document.getElementById('hangupCallBtn').addEventListener('click', hangupCall);
}

// 核心UI邏輯
function applyAvatarStyle(element, imgData, defaultText) {
    if (imgData) {
        element.style.backgroundImage = `url('${imgData}')`;
        element.innerText = '';
    } else {
        element.style.backgroundImage = 'none';
        element.innerText = defaultText.charAt(0);
    }
}

function toggleTheme() { document.body.classList.toggle('light-theme'); }
function editOtherAvatar() { triggerFileSelect((img) => { otherProfile.imgData = img; updateAllUI(); }); }
function editOtherName() {
    const newName = prompt("請輸入對方的備註名稱:", otherProfile.name);
    if (newName && newName.trim() !== "") { otherProfile.name = newName.trim(); updateAllUI(); }
}
function editMyAvatar() { triggerFileSelect((img) => { myProfile.imgData = img; updateAllUI(); }); }
function editMyName() {
    const newName = prompt("請輸入你的個人暱稱:", myProfile.name);
    if (newName && newName.trim() !== "") { myProfile.name = newName.trim(); updateAllUI(); }
}

function triggerFileSelect(callback) {
    const fileInput = document.getElementById('hiddenFileInput');
    fileInput.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) { callback(event.target.result); };
            reader.readAsDataURL(file);
        }
    };
    fileInput.click();
}

function updateAllUI() {
    applyAvatarStyle(document.getElementById('headerOtherAvatar'), otherProfile.imgData, otherProfile.name);
    applyAvatarStyle(document.getElementById('headerMyAvatar'), myProfile.imgData, myProfile.name);
    document.getElementById('chatTitle').innerText = otherProfile.name;
    document.getElementById('headerMyName').innerText = myProfile.name;
    renderMessages();
}

function renderMessages() {
    const area = document.getElementById('messageArea');
    area.innerHTML = '';
    
    chatHistory.forEach(msg => {
        const row = document.createElement('div');
        if(msg.type === 'system') {
            row.className = 'message-row system-log';
            row.innerHTML = `<span class="system-log-text">${msg.text}</span>`;
        } else {
            row.className = `message-row ${msg.type}`;
            const av = document.createElement('div');
            av.className = 'avatar-box msg-avatar';
            if(msg.type === 'me') applyAvatarStyle(av, myProfile.imgData, myProfile.name);
            else applyAvatarStyle(av, otherProfile.imgData, otherProfile.name);
            
            const mBox = document.createElement('div');
            mBox.className = `message ${msg.type}`;
            mBox.innerHTML = `${msg.text} <span style="display:block; font-size:10px; color:var(--text-muted); margin-top:4px; text-align:right;">${msg.time || ''}</span>`;
            row.appendChild(av); row.appendChild(mBox);
        }
        area.appendChild(row);
    });

    const stickyTyping = document.getElementById('typingBarSticky');
    if (isTyping) {
        document.getElementById('typingNameText').innerText = otherProfile.name;
        stickyTyping.style.display = 'block';
    } else {
        stickyTyping.style.display = 'none';
    }
    area.scrollTop = area.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    if (input.value.trim() === '') return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    
    chatHistory.push({ type: 'me', text: input.value.trim(), time: timeStr });
    renderMessages();
    input.value = '';
    resetNextInitiativeTime();
    triggerVirtualReply();
}

function triggerVirtualReply() {
    if (isTyping) return; 
    isTyping = true;
    renderMessages();

    const minSec = replySpeedConfig.min;
    const maxSec = replySpeedConfig.max >= minSec ? replySpeedConfig.max : minSec;
    const chosenSeconds = Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;

    setTimeout(() => {
        let replyText = "";
        if (cardDatabase.length === 0) {
            replyText = "(未載入字卡數據)";
        } else {
            const pickCount = Math.min(cardDatabase.length, Math.floor(Math.random() * 2) + 1);
            let selectedTexts = [];
            for(let i=0; i<pickCount; i++) {
                const randomIdx = Math.floor(Math.random() * cardDatabase.length);
                selectedTexts.push(cardDatabase[randomIdx].text);
            }
            replyText = selectedTexts.join(" ");
        }

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
        chatHistory.push({ type: 'other', text: replyText, time: timeStr });
        isTyping = false;
        renderMessages();
        resetNextInitiativeTime();
    }, chosenSeconds * 1000);
}

function forceTriggerOtherMessage() { if(!isTyping) triggerVirtualReply(); }
function resetNextInitiativeTime() {
    nextInitiativeTriggerTime = Date.now() + ((Math.floor(Math.random() * (maxInitiativeMinutes * 60 - 5 + 1)) + 5) * 1000);
}

function startInitiativeMonitor() {
    if(initiativeCheckInterval) clearInterval(initiativeCheckInterval);
    resetNextInitiativeTime();
    initiativeCheckInterval = setInterval(() => {
        if (allowInitiativeMessage && !isTyping && Date.now() >= nextInitiativeTriggerTime) {
            triggerVirtualReply();
        }
    }, 1000);
}

function toggleInitiativeSubfields() {
    document.getElementById('initiativeTimeSubfield').style.display = document.getElementById('allowInitiativeSwitch').checked ? 'block' : 'none';
}

function openPrefPanel() {
    document.getElementById('prefModalOverlay').style.display = 'flex';
    document.getElementById('inputMyNameForm').value = myProfile.name;
    document.getElementById('inputOtherNameForm').value = otherProfile.name;
    document.getElementById('speedMinInput').value = replySpeedConfig.min;
    document.getElementById('speedMaxInput').value = replySpeedConfig.max;
    document.getElementById('allowInitiativeSwitch').checked = allowInitiativeMessage;
    document.getElementById('initiativeMinutesInput').value = maxInitiativeMinutes;
    toggleInitiativeSubfields();
    navigateToLayer('segmentMainMenu', '配置控制中心');
    renderCardDatabaseList();
}

function closePrefPanel() { document.getElementById('prefModalOverlay').style.display = 'none'; }
function navigateToLayer(targetSegmentId, titleText) {
    document.querySelectorAll('.panel-view-segment').forEach(seg => seg.classList.remove('active'));
    document.getElementById(targetSegmentId).classList.add('active');
    document.getElementById('panelNavTitle').innerText = titleText;
}
function switchSegment(id, title) { navigateToLayer(id, title); }

function saveChatAdjustSettings() {
    myProfile.name = document.getElementById('inputMyNameForm').value.trim() || myProfile.name;
    otherProfile.name = document.getElementById('inputOtherNameForm').value.trim() || otherProfile.name;
    replySpeedConfig.min = parseInt(document.getElementById('speedMinInput').value) || replySpeedConfig.min;
    replySpeedConfig.max = parseInt(document.getElementById('speedMaxInput').value) || replySpeedConfig.min;
    allowInitiativeMessage = document.getElementById('allowInitiativeSwitch').checked;
    maxInitiativeMinutes = parseInt(document.getElementById('initiativeMinutesInput').value) || maxInitiativeMinutes;
    if(allowInitiativeMessage) resetNextInitiativeTime();
    updateAllUI();
    alert("設定已儲存！");
}

function clearChatLogs() {
    if(confirm("確定要排空聊天紀錄嗎？")) { chatHistory = []; isTyping = false; renderMessages(); }
}

function triggerBgSelect() { document.getElementById('bgImageFileInput').click(); }
function handleBgImageSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('mainChatWindow').style.backgroundImage = `url('${e.target.result}')`;
            document.getElementById('bgPreviewContainer').style.backgroundImage = `url('${e.target.result}')`;
            document.getElementById('bgPreviewContainer').innerText = "";
        };
        reader.readAsDataURL(file);
    }
}
function resetBgImage() {
    document.getElementById('mainChatWindow').style.backgroundImage = 'none';
    document.getElementById('bgPreviewContainer').style.backgroundImage = 'none';
    document.getElementById('bgPreviewContainer').innerText = "暫無自訂背景圖";
}

function checkTextareaContent() {
    document.getElementById('injectBtn').classList.toggle('ready-inject', document.getElementById('importTextarea').value.trim() !== "");
}
function addNewGroup(customName = null) {
    const gName = customName || prompt("請輸入新分組名稱:");
    if(gName && gName.trim() !== "") {
        const dropdown = document.getElementById('groupDropdown');
        for (let i = 0; i < dropdown.options.length; i++) if (dropdown.options[i].value === gName.trim()) return gName.trim();
        const opt = document.createElement('option'); opt.value = gName.trim(); opt.innerText = gName.trim();
        dropdown.appendChild(opt); dropdown.value = gName.trim(); return gName.trim();
    }
    return null;
}

function injectIntoPool() {
    const tx = document.getElementById('importTextarea');
    const group = document.getElementById('groupDropdown').value;
    if(!tx.value.trim()) return;
    tx.value.split('\n').forEach(line => {
        if(line.trim()) cardDatabase.push({ id: Date.now() + Math.random(), group: group, text: line.trim() });
    });
    tx.value = ""; checkTextareaContent(); renderCardDatabaseList();
}

function triggerJsonSelect() { document.getElementById('jsonFileInput').click(); }
function handleJsonImport(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonData = JSON.parse(e.target.result); let total = 0;
            if (jsonData && Array.isArray(jsonData.customReplyGroups)) {
                jsonData.customReplyGroups.forEach(g => {
                    addNewGroup(g.name);
                    if(Array.isArray(g.items)) g.items.forEach(t => { if(t.trim()) { cardDatabase.push({ id: Date.now()+Math.random(), group: g.name.trim(), text: t.trim() }); total++; } });
                });
            } else if (jsonData && Array.isArray(jsonData.customReplies)) {
                jsonData.customReplies.forEach(t => { if(t.trim()) { cardDatabase.push({ id: Date.now()+Math.random(), group: "預設分組", text: t.trim() }); total++; } });
            }
            alert(`導入成功，共 ${total} 筆！`); renderCardDatabaseList();
        } catch { alert("解析失敗！"); }
    };
    reader.readAsText(file);
}

function renderCardDatabaseList() {
    const container = document.getElementById('loadedCardsContainer'); container.innerHTML = "";
    cardDatabase.forEach(item => {
        const div = document.createElement('div'); div.className = 'card-list-item';
        div.innerHTML = `<div class="card-item-left"><input type="checkbox" class="card-checkbox" data-id="${item.id}"><span class="group-badge">${item.group}</span><span class="card-item-text">${item.text}</span></div><span class="card-item-del-x" data-id="${item.id}">×</span>`;
        
        // 單獨綁定 X 按鈕刪除事件
        div.querySelector('.card-item-del-x').addEventListener('click', (e) => {
            const id = parseFloat(e.target.getAttribute('data-id'));
            deleteSingleCard(id);
        });
        container.appendChild(div);
    });
}
function deleteSingleCard(id) { cardDatabase = cardDatabase.filter(i => i.id !== id); renderCardDatabaseList(); }
function selectAllCards(status) { document.querySelectorAll('.card-checkbox').forEach(cb => cb.checked = status); }
function deleteSelectedCards() {
    let ids = Array.from(document.querySelectorAll('.card-checkbox:checked')).map(cb => parseFloat(cb.getAttribute('data-id')));
    cardDatabase = cardDatabase.filter(i => !ids.includes(i.id)); renderCardDatabaseList();
}

function startCallSession() {
    clearInterval(callTimer); clearTimeout(autoResponseTimeout); callSeconds = 0;
    document.getElementById('fullCallName').innerText = otherProfile.name;
    applyAvatarStyle(document.getElementById('fullCallAvatar'), otherProfile.imgData, otherProfile.name);
    document.getElementById('fullCallScreen').style.display = 'flex';
    autoResponseTimeout = setTimeout(() => {
        callTimer = setInterval(() => {
            callSeconds++;
            document.getElementById('fullCallTimer').innerText = `${String(Math.floor(callSeconds / 60)).padStart(2, '0')}:${String(callSeconds % 60).padStart(2, '0')}`;
        }, 1000);
    }, 2500);
}
function hangupCall() { clearInterval(callTimer); clearTimeout(autoResponseTimeout); document.getElementById('fullCallScreen').style.display = 'none'; }
