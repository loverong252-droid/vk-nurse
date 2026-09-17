/**
 * ระบบห้องพยาบาล โรงเรียนวิสุทธิกษัตรี จ.สมุทรปราการ
 * Logic & State Controller (app.js)
 */

// Storage Keys
const STORAGE_KEY = 'vk_nurse_records_v1';
const RECORDER_KEY = 'vk_nurse_last_recorder';
const AUTH_KEY = 'vk_nurse_logged_user';

// Main State
let appState = {
  records: [],
  activeTab: 'entry',
  statsMode: 'weekly', // 'daily', 'weekly', 'monthly', 'yearly'
  statsDate: new Date(),
  tableFilters: {
    search: '',
    dateRange: 'all', // 'all', 'today', 'this_week', 'this_month', 'custom'
    customStart: '',
    customEnd: '',
    type: 'all',
    grade: 'all'
  },
  currentPage: 1,
  pageSize: 15,
  editingId: null,
  isCloud: false,
  deferredInstallPrompt: null
};

// Common Class Configuration based on User Specification:
// ม.1-ม.3 แต่ละระดับชั้นมีทั้งหมด 6 ห้อง
// ม.4-ม.6 แต่ละระดับชั้นมีทั้งหมด 12 ห้อง
const CLASS_CONFIG = {
  'ม.1': 6,
  'ม.2': 6,
  'ม.3': 6,
  'ม.4': 12,
  'ม.5': 12,
  'ม.6': 12
};

// Document Ready Initialization
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initStorage();
  initClock();
  initNavTabs();
  initClassRoomSelectors();
  initQuickTags();
  initForm();
  initTableFilters();
  initStatsFilters();
  initBackupRestore();
  initCloudSync();
  renderAll();
});

/* ==========================================================================
   Storage & Demo Data
   ========================================================================== */
function initStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      appState.records = JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing stored records', e);
      appState.records = [];
    }
  } else {
    // โหลดข้อมูลตัวอย่างเริ่มต้นเพื่อให้เห็นระบบสถิติทันที
    loadSampleData(false);
  }

  // Restore last recorder name
  const lastRecorder = localStorage.getItem(RECORDER_KEY);
  if (lastRecorder) {
    const input = document.getElementById('recordBy');
    if (input) input.value = lastRecorder;
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.records));
  updateStatsBadge();
}

function updateStatsBadge() {
  const countEl = document.getElementById('recordCountBadge');
  if (countEl) {
    countEl.textContent = `${appState.records.length} รายการ`;
  }
}

/* ==========================================================================
   Clock
   ========================================================================== */
function initClock() {
  const timeEl = document.getElementById('headerClockTime');
  const dateEl = document.getElementById('headerClockDate');
  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

  function update() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    if (timeEl) timeEl.textContent = `${h}:${m}:${s} น.`;

    const dayName = thaiDays[now.getDay()];
    const day = now.getDate();
    const month = thaiMonths[now.getMonth()];
    const year = now.getFullYear() + 543;
    if (dateEl) dateEl.textContent = `วัน${dayName}ที่ ${day} ${month} ${year}`;
  }

  update();
  setInterval(update, 1000);
}

/* ==========================================================================
   Navigation Tabs
   ========================================================================== */
function initNavTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const targetId = tab.getAttribute('data-target');
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');

      appState.activeTab = targetId;

      if (targetId === 'stats') {
        renderStatistics();
      } else if (targetId === 'records') {
        renderTable();
      }
    });
  });
}

function switchTab(tabId) {
  const tabBtn = document.querySelector(`.tab-btn[data-target="${tabId}"]`);
  if (tabBtn) tabBtn.click();
}

/* ==========================================================================
   Dynamic Class & Room Logic (ตามข้อกำหนด ม.1-3 = 6 ห้อง, ม.4-6 = 12 ห้อง)
   ========================================================================== */
function initClassRoomSelectors() {
  // Form elements
  const userTypeInputs = document.querySelectorAll('input[name="userType"]');
  const studentBox = document.getElementById('studentFieldsBox');
  const staffBox = document.getElementById('staffFieldsBox');
  const gradeSelect = document.getElementById('studentGrade');
  const roomSelect = document.getElementById('studentRoom');

  userTypeInputs.forEach(radio => {
    radio.addEventListener('change', (e) => {
      toggleUserTypeFields(e.target.value);
    });
  });

  if (gradeSelect && roomSelect) {
    gradeSelect.addEventListener('change', () => {
      updateRoomOptions(gradeSelect.value, roomSelect);
    });
  }

  // Modal elements
  const modalGrade = document.getElementById('editStudentGrade');
  const modalRoom = document.getElementById('editStudentRoom');
  if (modalGrade && modalRoom) {
    modalGrade.addEventListener('change', () => {
      updateRoomOptions(modalGrade.value, modalRoom);
    });
  }
}

function toggleUserTypeFields(type, prefix = '') {
  const studentBox = document.getElementById(prefix ? `${prefix}StudentFieldsBox` : 'studentFieldsBox');
  const staffBox = document.getElementById(prefix ? `${prefix}StaffFieldsBox` : 'staffFieldsBox');
  if (!studentBox || !staffBox) return;

  if (type === 'student') {
    studentBox.style.display = 'block';
    staffBox.style.display = 'none';
  } else {
    studentBox.style.display = 'none';
    staffBox.style.display = 'block';
  }
}

function updateRoomOptions(grade, roomSelectEl, selectedRoom = '') {
  roomSelectEl.innerHTML = '<option value="">-- เลือกห้อง --</option>';
  if (!grade || !CLASS_CONFIG[grade]) return;

  const totalRooms = CLASS_CONFIG[grade];
  for (let r = 1; r <= totalRooms; r++) {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = `ห้อง ${r} (${grade}/${r})`;
    if (selectedRoom && String(selectedRoom) === String(r)) {
      opt.selected = true;
    }
    roomSelectEl.appendChild(opt);
  }
}

/* ==========================================================================
   Quick Tags Selection
   ========================================================================== */
function initQuickTags() {
  // Symptom Tags
  const symptomTags = document.querySelectorAll('.quick-tag[data-symptom]');
  const symptomInput = document.getElementById('symptoms');
  symptomTags.forEach(tag => {
    tag.addEventListener('click', () => {
      const val = tag.getAttribute('data-symptom');
      appendOrToggleInput(symptomInput, val, tag);
    });
  });

  // Treatment Tags
  const treatTags = document.querySelectorAll('.quick-tag[data-treatment]');
  const treatInput = document.getElementById('treatment');
  treatTags.forEach(tag => {
    tag.addEventListener('click', () => {
      const val = tag.getAttribute('data-treatment');
      appendOrToggleInput(treatInput, val, tag);
    });
  });

  // Medication Tags
  const medTags = document.querySelectorAll('.quick-tag[data-med]');
  const medInput = document.getElementById('medication');
  medTags.forEach(tag => {
    tag.addEventListener('click', () => {
      const val = tag.getAttribute('data-med');
      if (val === 'ไม่ได้จ่ายยา') {
        medInput.value = 'ไม่ได้จ่ายยา';
        medTags.forEach(t => t.classList.remove('selected'));
        tag.classList.add('selected');
      } else {
        // Unselect 'ไม่ได้จ่ายยา' if selecting medicines
        const noMedTag = document.querySelector('.quick-tag[data-med="ไม่ได้จ่ายยา"]');
        if (noMedTag) noMedTag.classList.remove('selected');
        appendOrToggleInput(medInput, val, tag, 'ไม่ได้จ่ายยา');
      }
    });
  });
}

function appendOrToggleInput(inputEl, text, tagEl, removeExact = null) {
  if (!inputEl) return;
  let current = inputEl.value.trim();

  if (removeExact && current === removeExact) {
    current = '';
  }

  let items = current ? current.split(',').map(s => s.trim()).filter(Boolean) : [];

  const index = items.indexOf(text);
  if (index > -1) {
    items.splice(index, 1);
    if (tagEl) tagEl.classList.remove('selected');
  } else {
    items.push(text);
    if (tagEl) tagEl.classList.add('selected');
  }

  inputEl.value = items.join(', ');
}

/* ==========================================================================
   Form Handling & Record Submission
   ========================================================================== */
function initForm() {
  const form = document.getElementById('visitForm');
  const nowInput = document.getElementById('visitDatetime');

  // Set default datetime to now
  if (nowInput) {
    setNowDatetime(nowInput);
  }

  // Initialize Grade 1 rooms by default
  const gradeSelect = document.getElementById('studentGrade');
  const roomSelect = document.getElementById('studentRoom');
  if (gradeSelect && roomSelect) {
    gradeSelect.value = 'ม.1';
    updateRoomOptions('ม.1', roomSelect);
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveNewRecord();
    });

    form.addEventListener('reset', () => {
      setTimeout(() => {
        setNowDatetime(nowInput);
        document.querySelectorAll('.quick-tag').forEach(t => t.classList.remove('selected'));
        toggleUserTypeFields('student');
        if (gradeSelect && roomSelect) {
          gradeSelect.value = 'ม.1';
          updateRoomOptions('ม.1', roomSelect);
        }
        // Retain last recorder
        const lastRec = localStorage.getItem(RECORDER_KEY);
        if (lastRec) document.getElementById('recordBy').value = lastRec;
      }, 50);
    });
  }
}

function setNowDatetime(inputEl) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  inputEl.value = `${year}-${month}-${date}T${hours}:${minutes}`;
}

function saveNewRecord() {
  const userType = document.querySelector('input[name="userType"]:checked').value;
  const fullName = document.getElementById('fullName').value.trim();
  const gender = document.getElementById('gender').value;
  const visitDatetime = document.getElementById('visitDatetime').value;
  const symptoms = document.getElementById('symptoms').value.trim();
  const treatment = document.getElementById('treatment').value.trim();
  const medication = document.getElementById('medication').value.trim();
  const recordBy = document.getElementById('recordBy').value.trim();
  const notes = document.getElementById('notes').value.trim();
  const temp = document.getElementById('temperature').value.trim();
  const vitalBp  = document.getElementById('vitalBp').value.trim();
  const vitalHr  = document.getElementById('vitalHr').value.trim();
  const vitalSpo2 = document.getElementById('vitalSpo2').value.trim();
  const vitalRr  = document.getElementById('vitalRr').value.trim();
  const vitalDtx = document.getElementById('vitalDtx').value.trim();

  if (!fullName) {
    showToast('กรุณากรอกชื่อ-นามสกุล ผู้ใช้บริการ', 'error');
    document.getElementById('fullName').focus();
    return;
  }

  if (!symptoms) {
    showToast('กรุณาระบุอาการเจ็บป่วย', 'error');
    document.getElementById('symptoms').focus();
    return;
  }

  if (!recordBy) {
    showToast('กรุณาระบุชื่อผู้บันทึก', 'error');
    document.getElementById('recordBy').focus();
    return;
  }

  let grade = '';
  let room = '';
  let studentNo = '';
  let position = '';

  if (userType === 'student') {
    grade = document.getElementById('studentGrade').value;
    room = document.getElementById('studentRoom').value;
    studentNo = document.getElementById('studentNo').value;

    if (!grade || !room) {
      showToast('กรุณาเลือกระดับชั้นและห้องเรียนของนักเรียน', 'error');
      return;
    }
  } else {
    position = document.getElementById('staffPosition').value.trim() || 'ครู / บุคลากร';
  }

  const newRecord = {
    id: 'VK_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    createdAt: new Date().toISOString(),
    datetime: visitDatetime || new Date().toISOString(),
    userType,
    fullName,
    gender: gender || 'ไม่ระบุ',
    grade,
    room,
    studentNo,
    position,
    symptoms,
    treatment: treatment || 'ให้คำแนะนำและสังเกตอาการ',
    medication: medication || 'ไม่ได้จ่ายยา',
    recordBy,
    notes,
    temperature: temp,
    vitalBp,
    vitalHr,
    vitalSpo2,
    vitalRr,
    vitalDtx
  };

  // Remember recorder
  localStorage.setItem(RECORDER_KEY, recordBy);

  // Add to records (newest first)
  appState.records.unshift(newRecord);
  saveRecords();

  if (appState.isCloud) {
    sendRecordToCloud(newRecord);
  }

  showToast(`บันทึกข้อมูลของ ${fullName} เรียบร้อยแล้ว`, 'success');

  // Reset form cleanly
  document.getElementById('fullName').value = '';
  document.getElementById('symptoms').value = '';
  document.getElementById('treatment').value = '';
  document.getElementById('medication').value = '';
  document.getElementById('notes').value = '';
  document.getElementById('temperature').value = '';
  document.getElementById('vitalBp').value = '';
  document.getElementById('vitalHr').value = '';
  document.getElementById('vitalSpo2').value = '';
  document.getElementById('vitalRr').value = '';
  document.getElementById('vitalDtx').value = '';
  document.querySelectorAll('.quick-tag').forEach(t => t.classList.remove('selected'));
  setNowDatetime(document.getElementById('visitDatetime'));
  document.getElementById('fullName').focus();

  renderAll();
}

/* ==========================================================================
   Table & Logbook Rendering
   ========================================================================== */
function initTableFilters() {
  const searchInput = document.getElementById('tableSearch');
  const dateRange = document.getElementById('filterDateRange');
  const customDateRange = document.getElementById('customDateRange');
  const customStart = document.getElementById('filterStartDate');
  const customEnd = document.getElementById('filterEndDate');
  const typeFilter = document.getElementById('filterUserType');
  const gradeFilter = document.getElementById('filterGrade');
  const resetBtn = document.getElementById('btnResetFilters');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      appState.tableFilters.search = e.target.value.toLowerCase();
      appState.currentPage = 1;
      renderTable();
    });
  }

  if (dateRange) {
    dateRange.addEventListener('change', (e) => {
      appState.tableFilters.dateRange = e.target.value;
      if (customDateRange) {
        customDateRange.style.display = e.target.value === 'custom' ? 'flex' : 'none';
      }
      appState.currentPage = 1;
      renderTable();
    });
  }

  if (customStart) {
    customStart.addEventListener('change', (e) => {
      appState.tableFilters.customStart = e.target.value;
      renderTable();
    });
  }
  if (customEnd) {
    customEnd.addEventListener('change', (e) => {
      appState.tableFilters.customEnd = e.target.value;
      renderTable();
    });
  }

  if (typeFilter) {
    typeFilter.addEventListener('change', (e) => {
      appState.tableFilters.type = e.target.value;
      appState.currentPage = 1;
      renderTable();
    });
  }

  if (gradeFilter) {
    gradeFilter.addEventListener('change', (e) => {
      appState.tableFilters.grade = e.target.value;
      appState.currentPage = 1;
      renderTable();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (dateRange) dateRange.value = 'all';
      if (customDateRange) customDateRange.style.display = 'none';
      if (typeFilter) typeFilter.value = 'all';
      if (gradeFilter) gradeFilter.value = 'all';
      appState.tableFilters = {
        search: '',
        dateRange: 'all',
        customStart: '',
        customEnd: '',
        type: 'all',
        grade: 'all'
      };
      appState.currentPage = 1;
      renderTable();
    });
  }

  // Pagination buttons
  const prevBtn = document.getElementById('btnPrevPage');
  const nextBtn = document.getElementById('btnNextPage');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (appState.currentPage > 1) {
        appState.currentPage--;
        renderTable();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      appState.currentPage++;
      renderTable();
    });
  }

  // Export & Print buttons
  const exportBtn = document.getElementById('btnExportCsv');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToCsv);
  }
}

function getFilteredRecords() {
  const { search, dateRange, customStart, customEnd, type, grade } = appState.tableFilters;
  const now = new Date();

  return appState.records.filter(record => {
    // Type Filter
    if (type !== 'all' && record.userType !== type) return false;

    // Grade Filter
    if (grade !== 'all') {
      if (record.userType !== 'student' || record.grade !== grade) return false;
    }

    // Search query
    if (search) {
      const matchName = (record.fullName || '').toLowerCase().includes(search);
      const matchSymptom = (record.symptoms || '').toLowerCase().includes(search);
      const matchTreatment = (record.treatment || '').toLowerCase().includes(search);
      const matchMed = (record.medication || '').toLowerCase().includes(search);
      const matchRecorder = (record.recordBy || '').toLowerCase().includes(search);
      const matchClass = `${record.grade}/${record.room}`.toLowerCase().includes(search);
      if (!matchName && !matchSymptom && !matchTreatment && !matchMed && !matchRecorder && !matchClass) {
        return false;
      }
    }

    // Date Range Filter
    const recDate = new Date(record.datetime);
    if (dateRange === 'today') {
      const isToday = recDate.toDateString() === now.toDateString();
      if (!isToday) return false;
    } else if (dateRange === 'this_week') {
      const day = now.getDay();
      const diffToMonday = now.getDate() - (day === 0 ? 6 : day - 1);
      const monday = new Date(now.setDate(diffToMonday));
      monday.setHours(0, 0, 0, 0);
      if (recDate < monday) return false;
    } else if (dateRange === 'this_month') {
      if (recDate.getMonth() !== now.getMonth() || recDate.getFullYear() !== now.getFullYear()) {
        return false;
      }
    } else if (dateRange === 'custom') {
      if (customStart) {
        const s = new Date(customStart);
        s.setHours(0, 0, 0, 0);
        if (recDate < s) return false;
      }
      if (customEnd) {
        const e = new Date(customEnd);
        e.setHours(23, 59, 59, 999);
        if (recDate > e) return false;
      }
    }

    return true;
  });
}

function renderTable() {
  const tbody = document.getElementById('recordsTableBody');
  const countDisplay = document.getElementById('tableCountDisplay');
  const pageInfo = document.getElementById('tablePageInfo');
  const prevBtn = document.getElementById('btnPrevPage');
  const nextBtn = document.getElementById('btnNextPage');
  if (!tbody) return;

  const filtered = getFilteredRecords();
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / appState.pageSize) || 1;

  if (appState.currentPage > totalPages) appState.currentPage = totalPages;
  if (appState.currentPage < 1) appState.currentPage = 1;

  const startIdx = (appState.currentPage - 1) * appState.pageSize;
  const pageRecords = filtered.slice(startIdx, startIdx + appState.pageSize);

  if (countDisplay) {
    countDisplay.textContent = `พบ ${totalItems} รายการ (แสดงหน้า ${appState.currentPage}/${totalPages})`;
  }
  if (pageInfo) {
    pageInfo.textContent = `หน้า ${appState.currentPage} / ${totalPages}`;
  }
  if (prevBtn) prevBtn.disabled = appState.currentPage <= 1;
  if (nextBtn) nextBtn.disabled = appState.currentPage >= totalPages;

  if (pageRecords.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;padding:3rem;color:#94a3b8;">
          <div style="font-size:2rem;margin-bottom:0.5rem;">🔍</div>
          <div>ไม่พบรายการข้อมูลตามเงื่อนไขที่เลือก</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pageRecords.map((r, i) => {
    const formattedDate = formatThaiDateTime(r.datetime);
    const roleBadge = r.userType === 'student'
      ? `<span class="badge badge-student">นักเรียน</span>`
      : `<span class="badge badge-staff">บุคลากร</span>`;
    
    const classOrPos = r.userType === 'student'
      ? `<strong>${r.grade}/${r.room}</strong> ${r.studentNo ? `(เลขที่ ${r.studentNo})` : ''}`
      : `<span style="color:#64748b;">${r.position || 'บุคลากร'}</span>`;

    const isBedRest = (r.treatment || '').includes('นอนพัก');
    const isHospital = (r.treatment || '').includes('นำส่งโรงพยาบาล');
    const hasMed = r.medication && r.medication !== 'ไม่ได้จ่ายยา';

    return `
      <tr>
        <td style="color:#64748b;font-size:0.85rem;">${startIdx + i + 1}</td>
        <td>
          <div style="font-weight:600;font-size:0.9rem;">${formattedDate.date}</div>
          <div style="color:#64748b;font-size:0.8rem;">${formattedDate.time} น.</div>
        </td>
        <td>
          <div style="font-weight:700;color:#1e3a8a;">${escapeHtml(r.fullName)}</div>
          <div style="margin-top:2px;">${roleBadge}</div>
        </td>
        <td>${classOrPos}</td>
        <td>
          <div style="font-weight:600;color:#dc2626;">${escapeHtml(r.symptoms)}</div>
          ${r.temperature ? `<span style="font-size:0.75rem;color:#64748b;">🌡️ ${r.temperature} °C</span>` : ''}
        </td>
        <td>
          <div>${escapeHtml(r.treatment)}</div>
          ${isHospital ? `<span class="badge mt-1" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;">🚑 นำส่ง รพ.</span>` : ''}
          ${isBedRest ? `<span class="badge badge-rest mt-1">🛏️ นอนพัก</span>` : ''}
        </td>
        <td>
          <div style="font-size:0.88rem;">${escapeHtml(r.medication)}</div>
          ${hasMed ? `<span class="badge badge-med mt-1">💊 จ่ายยา</span>` : ''}
        </td>
        <td>
          <div class="d-flex gap-1">
            <button class="btn btn-secondary btn-sm" title="ดูรายละเอียดและพิมพ์ใบรับรอง" onclick="viewRecordDetail('${r.id}')">📄</button>
            <button class="btn btn-secondary btn-sm" title="แก้ไขข้อมูล" onclick="openEditModal('${r.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" title="ลบรายการ" onclick="deleteRecord('${r.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/* ==========================================================================
   Record Modal & Actions
   ========================================================================== */
function viewRecordDetail(id) {
  const r = appState.records.find(item => item.id === id);
  if (!r) return;

  const modalBody = document.getElementById('viewModalBody');
  if (!modalBody) return;

  const formattedDate = formatThaiDateTime(r.datetime);
  const classOrPos = r.userType === 'student'
    ? `${r.grade}/${r.room} ${r.studentNo ? `(เลขที่ ${r.studentNo})` : ''}`
    : `${r.position || 'บุคลากร'}`;

  modalBody.innerHTML = `
    <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 1rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h3 style="color:#1e3a8a;font-size:1.2rem;margin:0;">บันทึกการใช้บริการห้องพยาบาล</h3>
        <p style="color:#64748b;font-size:0.85rem;margin:0;">โรงเรียนวิสุทธิกษัตรี จ.สมุทรปราการ</p>
      </div>
      <img src="assets/logo.jpg" style="height:55px;width:auto;" alt="ตราโรงเรียน">
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem;font-size:0.92rem;">
      <div><strong>วันที่-เวลา:</strong> ${formattedDate.date} เวลา ${formattedDate.time} น.</div>
      <div><strong>ประเภท:</strong> ${r.userType === 'student' ? 'นักเรียน' : 'บุคลากร'}</div>
      <div><strong>ชื่อ-นามสกุล:</strong> ${escapeHtml(r.fullName)}</div>
      <div><strong>ชั้น / ตำแหน่ง:</strong> ${classOrPos}</div>
      <div><strong>ผู้บันทึก:</strong> ${escapeHtml(r.recordBy || '-')}</div>
    </div>

    ${(r.vitalBp || r.vitalHr || r.vitalSpo2 || r.vitalRr || r.temperature || r.vitalDtx) ? `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:0.9rem;margin-bottom:1rem;">
      <div style="font-weight:700;color:#1e3a8a;margin-bottom:0.6rem;font-size:0.92rem;">🩺 สัญญาณชีพ (Vital Signs)</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;font-size:0.88rem;">
        ${r.vitalBp     ? `<div>💉 <strong>ความดัน:</strong> ${escapeHtml(r.vitalBp)} mmHg</div>` : ''}
        ${r.vitalHr     ? `<div>❤️ <strong>ชีพจร:</strong> ${escapeHtml(r.vitalHr)} ครั้ง/นาที</div>` : ''}
        ${r.vitalSpo2   ? `<div>🫧 <strong>SpO2:</strong> ${escapeHtml(r.vitalSpo2)} %</div>` : ''}
        ${r.vitalRr     ? `<div>🌬️ <strong>การหายใจ:</strong> ${escapeHtml(r.vitalRr)} ครั้ง/นาที</div>` : ''}
        ${r.temperature ? `<div>🌡️ <strong>อุณหภูมิ:</strong> ${escapeHtml(r.temperature)} °C</div>` : ''}
        ${r.vitalDtx    ? `<div>🩸 <strong>น้ำตาล:</strong> ${escapeHtml(r.vitalDtx)} mg/dL</div>` : ''}
      </div>
    </div>` : ''}

    <div style="background:#f8fafc;padding:1rem;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:1rem;">
      <div style="margin-bottom:0.6rem;">
        <strong style="color:#dc2626;">อาการเจ็บป่วย:</strong>
        <div style="margin-top:2px;">${escapeHtml(r.symptoms)}</div>
      </div>
      <div style="margin-bottom:0.6rem;">
        <strong style="color:#1e3a8a;">การรักษา / ปฐมพยาบาล:</strong>
        <div style="margin-top:2px;">${escapeHtml(r.treatment)}</div>
      </div>
      <div style="margin-bottom:0.6rem;">
        <strong style="color:#0f766e;">การจ่ายยา:</strong>
        <div style="margin-top:2px;">${escapeHtml(r.medication)}</div>
      </div>
      ${r.notes ? `<div><strong>หมายเหตุ:</strong> ${escapeHtml(r.notes)}</div>` : ''}
    </div>
  `;

  // Setup Print Slip Button in Modal
  const printBtn = document.getElementById('btnModalPrintSlip');
  if (printBtn) {
    printBtn.onclick = () => printSlip(r);
  }

  const modal = document.getElementById('viewModal');
  if (modal) modal.classList.add('active');
}

function openEditModal(id) {
  const r = appState.records.find(item => item.id === id);
  if (!r) return;

  appState.editingId = id;
  const modal = document.getElementById('editModal');
  if (!modal) return;

  // Set values
  document.getElementById('editFullName').value = r.fullName;
  document.getElementById('editGender').value = r.gender || 'ชาย';
  document.getElementById('editVisitDatetime').value = r.datetime.slice(0, 16);
  document.getElementById('editSymptoms').value = r.symptoms;
  document.getElementById('editTreatment').value = r.treatment;
  document.getElementById('editMedication').value = r.medication;
  document.getElementById('editRecordBy').value = r.recordBy;
  document.getElementById('editNotes').value = r.notes || '';
  document.getElementById('editTemperature').value = r.temperature || '';
  document.getElementById('editVitalBp').value  = r.vitalBp  || '';
  document.getElementById('editVitalHr').value  = r.vitalHr  || '';
  document.getElementById('editVitalSpo2').value = r.vitalSpo2 || '';
  document.getElementById('editVitalRr').value  = r.vitalRr  || '';
  document.getElementById('editVitalDtx').value = r.vitalDtx || '';

  // Type & Class
  const radioStudent = document.querySelector('input[name="editUserType"][value="student"]');
  const radioStaff = document.querySelector('input[name="editUserType"][value="staff"]');
  if (r.userType === 'student') {
    if (radioStudent) radioStudent.checked = true;
    toggleUserTypeFields('student', 'edit');
    const gradeSel = document.getElementById('editStudentGrade');
    const roomSel = document.getElementById('editStudentRoom');
    if (gradeSel) gradeSel.value = r.grade;
    updateRoomOptions(r.grade, roomSel, r.room);
    document.getElementById('editStudentNo').value = r.studentNo || '';
  } else {
    if (radioStaff) radioStaff.checked = true;
    toggleUserTypeFields('staff', 'edit');
    document.getElementById('editStaffPosition').value = r.position || '';
  }

  // Type change handler inside modal
  const editTypeInputs = document.querySelectorAll('input[name="editUserType"]');
  editTypeInputs.forEach(rad => {
    rad.onchange = (e) => toggleUserTypeFields(e.target.value, 'edit');
  });

  modal.classList.add('active');
}

function saveEditedRecord() {
  if (!appState.editingId) return;
  const r = appState.records.find(item => item.id === appState.editingId);
  if (!r) return;

  const userType = document.querySelector('input[name="editUserType"]:checked').value;
  r.userType = userType;
  r.fullName = document.getElementById('editFullName').value.trim();
  r.gender = document.getElementById('editGender').value;
  r.datetime = document.getElementById('editVisitDatetime').value;
  r.symptoms = document.getElementById('editSymptoms').value.trim();
  r.treatment = document.getElementById('editTreatment').value.trim();
  r.medication = document.getElementById('editMedication').value.trim();
  r.recordBy = document.getElementById('editRecordBy').value.trim();
  r.notes = document.getElementById('editNotes').value.trim();
  r.temperature = document.getElementById('editTemperature').value.trim();
  r.vitalBp  = document.getElementById('editVitalBp').value.trim();
  r.vitalHr  = document.getElementById('editVitalHr').value.trim();
  r.vitalSpo2 = document.getElementById('editVitalSpo2').value.trim();
  r.vitalRr  = document.getElementById('editVitalRr').value.trim();
  r.vitalDtx = document.getElementById('editVitalDtx').value.trim();

  if (userType === 'student') {
    r.grade = document.getElementById('editStudentGrade').value;
    r.room = document.getElementById('editStudentRoom').value;
    r.studentNo = document.getElementById('editStudentNo').value;
    r.position = '';
  } else {
    r.position = document.getElementById('editStaffPosition').value.trim();
    r.grade = '';
    r.room = '';
    r.studentNo = '';
  }

  saveRecords();
  if (appState.isCloud) {
    updateRecordOnCloud(r);
  }
  closeModal('editModal');
  showToast('บันทึกการแก้ไขเรียบร้อยแล้ว', 'success');
  renderAll();
}

function deleteRecord(id) {
  const r = appState.records.find(item => item.id === id);
  if (!r) return;

  if (confirm(`คุณต้องการลบรายการบันทึกของ "${r.fullName}" ใช่หรือไม่?`)) {
    appState.records = appState.records.filter(item => item.id !== id);
    saveRecords();
    if (appState.isCloud) {
      deleteRecordOnCloud(id);
    }
    showToast('ลบรายการบันทึกเรียบร้อยแล้ว', 'info');
    renderAll();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
  appState.editingId = null;
}

/* ==========================================================================
   Print Slip (ใบแจ้งการเข้าใช้บริการ/นอนพักห้องพยาบาล)
   ========================================================================== */
function printSlip(record) {
  const printArea = document.getElementById('printArea');
  if (!printArea) return;

  const formattedDate = formatThaiDateTime(record.datetime);
  const classOrPos = record.userType === 'student'
    ? `ชั้น ${record.grade}/${record.room} เลขที่ ${record.studentNo || '-'}`
    : `ตำแหน่ง: ${record.position || 'บุคลากร'}`;

  const isBedRest = (record.treatment || '').includes('นอนพัก');
  const isHospital = (record.treatment || '').includes('นำส่งโรงพยาบาล');

  printArea.innerHTML = `
    <div class="slip-box">
      <div class="slip-header">
        <div class="slip-title">
          <h2>โรงเรียนวิสุทธิกษัตรี จังหวัดสมุทรปราการ</h2>
          <p>งานห้องพยาบาล กลุ่มบริหารงานทั่วไป</p>
          <h3 style="margin-top:6px;font-size:16px;color:#dc2626;">ใบรับรองการเข้าใช้บริการ / พักฟื้นห้องพยาบาล</h3>
        </div>
        <img src="assets/logo.jpg" class="slip-logo" alt="ตราโรงเรียน">
      </div>

      <div class="slip-info-row">
        <div class="slip-label">วันที่มารับบริการ:</div>
        <div class="slip-value">${formattedDate.date} เวลา ${formattedDate.time} น.</div>
      </div>

      <div class="slip-info-row">
        <div class="slip-label">ชื่อ - นามสกุล:</div>
        <div class="slip-value"><strong>${escapeHtml(record.fullName)}</strong> (${record.userType === 'student' ? 'นักเรียน' : 'บุคลากร'})</div>
      </div>

      <div class="slip-info-row">
        <div class="slip-label">ระดับชั้น / ตำแหน่ง:</div>
        <div class="slip-value">${classOrPos}</div>
      </div>

      <div class="slip-info-row">
        <div class="slip-label">อาการเบื้องต้น:</div>
        <div class="slip-value">${escapeHtml(record.symptoms)}</div>
      </div>

      ${(record.vitalBp || record.vitalHr || record.vitalSpo2 || record.vitalRr || record.temperature || record.vitalDtx) ? `
      <div class="slip-info-row" style="align-items:flex-start;">
        <div class="slip-label">สัญญาณชีพ:</div>
        <div class="slip-value" style="display:flex;flex-wrap:wrap;gap:8px 20px;">
          ${record.vitalBp     ? `<span>💉 ความดัน: <strong>${escapeHtml(record.vitalBp)}</strong> mmHg</span>` : ''}
          ${record.vitalHr     ? `<span>❤️ ชีพจร: <strong>${escapeHtml(record.vitalHr)}</strong> ครั้ง/นาที</span>` : ''}
          ${record.vitalSpo2   ? `<span>🫧 SpO2: <strong>${escapeHtml(record.vitalSpo2)}</strong>%</span>` : ''}
          ${record.vitalRr     ? `<span>🌬️ การหายใจ: <strong>${escapeHtml(record.vitalRr)}</strong> ครั้ง/นาที</span>` : ''}
          ${record.temperature ? `<span>🌡️ อุณหภูมิ: <strong>${escapeHtml(record.temperature)}</strong> °C</span>` : ''}
          ${record.vitalDtx    ? `<span>🩸 น้ำตาล: <strong>${escapeHtml(record.vitalDtx)}</strong> mg/dL</span>` : ''}
        </div>
      </div>` : ''}

      <div class="slip-info-row">
        <div class="slip-label">การดูแลรักษา:</div>
        <div class="slip-value">${escapeHtml(record.treatment)}</div>
      </div>

      <div class="slip-info-row">
        <div class="slip-label">การจ่ายยา:</div>
        <div class="slip-value">${escapeHtml(record.medication)}</div>
      </div>

      <div class="slip-info-row">
        <div class="slip-label">ข้อปฏิบัติ / ผลตรวจ:</div>
        <div class="slip-value">${isHospital ? '⚠️ มีอาการที่ต้องได้รับการรักษาอย่างเร่งด่วน ได้ประสานงานและดำเนินการนำส่งโรงพยาบาลเรียบร้อยแล้ว' : isBedRest ? 'ได้รับอนุญาตให้นอนพักฟื้นสังเกตอาการที่ห้องพยาบาล' : 'ได้รับการปฐมพยาบาลเรียบร้อย อนุญาตให้กลับเข้าห้องเรียนได้'} ${record.notes ? `(${escapeHtml(record.notes)})` : ''}</div>
      </div>

      <div class="slip-signatures">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div style="margin-top:6px;">ลงชื่อ.......................................................</div>
          <div>( ${escapeHtml(record.recordBy || 'ครูเวรห้องพยาบาล')} )</div>
          <div style="color:#64748b;font-size:12px;">เจ้าหน้าที่ / ครูผู้บันทึก</div>
        </div>

        <div class="sig-box">
          <div class="sig-line"></div>
          <div style="margin-top:6px;">ลงชื่อ.......................................................</div>
          <div>(.......................................................)</div>
          <div style="color:#64748b;font-size:12px;">ครูประจำวิชา / ครูที่ปรึกษา ผู้รับทราบ</div>
        </div>
      </div>
    </div>
  `;

  window.print();
}

/* ==========================================================================
   Statistics & Dashboard (รายสัปดาห์ / รายเดือน / รายปี)
   ========================================================================== */
function initStatsFilters() {
  const modeBtns = document.querySelectorAll('.stats-nav-btn');
  const dateSelector = document.getElementById('statsDatePicker');
  const weekSelector = document.getElementById('statsWeekPicker');
  const monthSelector = document.getElementById('statsMonthPicker');
  const yearSelector = document.getElementById('statsYearPicker');

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  if (dateSelector) {
    dateSelector.value = todayStr;
    dateSelector.addEventListener('change', () => renderStatistics());
  }

  if (weekSelector) {
    weekSelector.value = todayStr;
    weekSelector.addEventListener('change', () => renderStatistics());
  }

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appState.statsMode = btn.getAttribute('data-mode');

      // Toggle controls
      if (dateSelector) dateSelector.style.display = appState.statsMode === 'daily' ? 'inline-block' : 'none';
      if (weekSelector) weekSelector.style.display = appState.statsMode === 'weekly' ? 'inline-block' : 'none';
      if (monthSelector) monthSelector.style.display = appState.statsMode === 'monthly' ? 'inline-block' : 'none';
      if (yearSelector) yearSelector.style.display = appState.statsMode === 'yearly' ? 'inline-block' : 'none';

      renderStatistics();
    });
  });

  // Init Pickers
  if (monthSelector) {
    monthSelector.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthSelector.addEventListener('change', () => renderStatistics());
  }

  if (yearSelector) {
    const currentYear = new Date().getFullYear();
    yearSelector.innerHTML = '';
    for (let y = currentYear; y >= currentYear - 4; y--) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = `ปีการศึกษา / ปี พ.ศ. ${y + 543} (${y})`;
      yearSelector.appendChild(opt);
    }
    yearSelector.addEventListener('change', () => renderStatistics());
  }

  // Print Summary Report Button
  const btnPrintStats = document.getElementById('btnPrintStatsReport');
  if (btnPrintStats) {
    btnPrintStats.addEventListener('click', printStatsReport);
  }
}

function getStatsFilteredRecords() {
  const mode = appState.statsMode;
  const now = new Date();

  if (mode === 'daily') {
    const dateInput = document.getElementById('statsDatePicker');
    let refDate = now;
    if (dateInput && dateInput.value) {
      const parts = dateInput.value.split('-');
      if (parts.length === 3) {
        refDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }
    const year = refDate.getFullYear();
    const month = refDate.getMonth();
    const date = refDate.getDate();

    const startOfDay = new Date(year, month, date, 0, 0, 0, 0);
    const endOfDay = new Date(year, month, date, 23, 59, 59, 999);

    const records = appState.records.filter(r => {
      const d = new Date(r.datetime);
      return d >= startOfDay && d <= endOfDay;
    });

    const thaiDayNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
    const thaiDay = thaiDayNames[refDate.getDay()];
    const thaiDateStr = `${thaiDay}ที่ ${date} ${formatThaiMonth(month)} พ.ศ. ${year + 543}`;

    return {
      records,
      title: `ประจำวัน (${thaiDateStr})`,
      refDate,
      date,
      month,
      year
    };
  } else if (mode === 'weekly') {
    // Current week or selected week
    const weekInput = document.getElementById('statsWeekPicker');
    let refDate = now;
    if (weekInput && weekInput.value) {
      refDate = new Date(weekInput.value);
    }
    const day = refDate.getDay();
    const diffToMonday = refDate.getDate() - (day === 0 ? 6 : day - 1);
    const monday = new Date(refDate.getFullYear(), refDate.getMonth(), diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const records = appState.records.filter(r => {
      const d = new Date(r.datetime);
      return d >= monday && d <= sunday;
    });

    return {
      records,
      title: `ประจำสัปดาห์ (วันจันทร์ที่ ${monday.getDate()} - วันอาทิตย์ที่ ${sunday.getDate()} ${formatThaiMonth(monday.getMonth())} ${monday.getFullYear() + 543})`,
      monday,
      sunday
    };
  } else if (mode === 'monthly') {
    const monthInput = document.getElementById('statsMonthPicker');
    let year = now.getFullYear();
    let month = now.getMonth();
    if (monthInput && monthInput.value) {
      const parts = monthInput.value.split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
    }

    const records = appState.records.filter(r => {
      const d = new Date(r.datetime);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    return {
      records,
      title: `ประจำเดือน ${formatThaiMonth(month)} พ.ศ. ${year + 543}`,
      year,
      month
    };
  } else {
    // Yearly
    const yearSelect = document.getElementById('statsYearPicker');
    let year = now.getFullYear();
    if (yearSelect && yearSelect.value) {
      year = parseInt(yearSelect.value, 10);
    }

    const records = appState.records.filter(r => {
      const d = new Date(r.datetime);
      return d.getFullYear() === year;
    });

    return {
      records,
      title: `ประจำปี พ.ศ. ${year + 543} (${year})`,
      year
    };
  }
}

function renderStatistics() {
  const { records, title, monday, year, month } = getStatsFilteredRecords();

  const titleEl = document.getElementById('statsPeriodTitle');
  if (titleEl) titleEl.textContent = title;

  // Subtitle for trend chart
  const subtitleEl = document.getElementById('trendChartSubtitle');
  if (subtitleEl) {
    if (appState.statsMode === 'daily') {
      subtitleEl.textContent = 'จำแนกตามช่วงเวลาของวัน (คาบเรียน / พักเที่ยง / หลังเลิกเรียน)';
    } else if (appState.statsMode === 'weekly') {
      subtitleEl.textContent = 'จำแนกตามวันในสัปดาห์ (จันทร์ - อาทิตย์)';
    } else if (appState.statsMode === 'monthly') {
      subtitleEl.textContent = 'จำแนกตามช่วงวันที่ในเดือน (1-7, 8-14, 15-21, 22-28, 29-31)';
    } else {
      subtitleEl.textContent = 'จำแนกตาม 12 เดือนในรอบปี';
    }
  }

  // KPI Calculations
  const totalVisits = records.length;
  const studentVisits = records.filter(r => r.userType === 'student').length;
  const staffVisits = records.filter(r => r.userType === 'staff').length;
  const bedRestCount = records.filter(r => (r.treatment || '').includes('นอนพัก')).length;
  const hospitalCount = records.filter(r => (r.treatment || '').includes('นำส่งโรงพยาบาล')).length;
  const medDispensedCount = records.filter(r => r.medication && r.medication !== 'ไม่ได้จ่ายยา').length;

  // Top Symptoms
  const symptomCounts = {};
  records.forEach(r => {
    if (!r.symptoms) return;
    const list = r.symptoms.split(',').map(s => s.trim()).filter(Boolean);
    list.forEach(sym => {
      symptomCounts[sym] = (symptomCounts[sym] || 0) + 1;
    });
  });

  const sortedSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1]);
  const topSymptomName = sortedSymptoms[0] ? sortedSymptoms[0][0] : '-';
  const topSymptomCount = sortedSymptoms[0] ? sortedSymptoms[0][1] : 0;

  // Most visited class
  const classCounts = {};
  records.filter(r => r.userType === 'student').forEach(r => {
    if (r.grade) {
      classCounts[r.grade] = (classCounts[r.grade] || 0) + 1;
    }
  });
  const sortedClasses = Object.entries(classCounts).sort((a, b) => b[1] - a[1]);
  const topClassName = sortedClasses[0] ? sortedClasses[0][0] : '-';
  const topClassCount = sortedClasses[0] ? sortedClasses[0][1] : 0;

  // Update KPI Elements
  setHtml('kpiTotalVisits', totalVisits);
  setHtml('kpiStudents', `${studentVisits} <span style="font-size:0.9rem;font-weight:normal;color:#64748b;">(${totalVisits ? Math.round((studentVisits / totalVisits) * 100) : 0}%)</span>`);
  setHtml('kpiStaff', `${staffVisits} <span style="font-size:0.9rem;font-weight:normal;color:#64748b;">(${totalVisits ? Math.round((staffVisits / totalVisits) * 100) : 0}%)</span>`);
  setHtml('kpiTopSymptom', topSymptomName);
  setHtml('kpiTopSymptomSub', topSymptomCount ? `${topSymptomCount} ราย (${Math.round((topSymptomCount / (totalVisits || 1)) * 100)}%)` : 'ยังไม่มีข้อมูล');
  setHtml('kpiTopClass', topClassName !== '-' ? `${topClassName} (${topClassCount} ราย)` : '-');
  setHtml('kpiBedRest', `${bedRestCount} ราย`);
  setHtml('kpiHospital', `${hospitalCount} ราย`);
  setHtml('kpiMedDispensed', `${medDispensedCount} ราย`);

  // Render Charts using our pure SVG chart engine
  renderTrendChart(records);
  renderSymptomChart(sortedSymptoms);
  renderGradeDistributionChart(records);
  renderClassSummaryTable(records);
}

function renderTrendChart(records) {
  const mode = appState.statsMode;
  const daysOfWeek = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
  const thaiMonthsShort = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  if (mode === 'daily') {
    // School hours slots
    const timeSlots = [
      { label: 'ก่อน 08:30', startH: 0, endH: 8.5 },
      { label: '08:30-10:00', startH: 8.5, endH: 10 },
      { label: '10:00-11:30', startH: 10, endH: 11.5 },
      { label: '11:30-13:00 (พัก)', startH: 11.5, endH: 13 },
      { label: '13:00-14:30', startH: 13, endH: 14.5 },
      { label: '14:30-16:00', startH: 14.5, endH: 16 },
      { label: 'หลัง 16:00', startH: 16, endH: 24 }
    ];

    const slotCounts = new Array(timeSlots.length).fill(0);
    records.forEach(r => {
      const d = new Date(r.datetime);
      const h = d.getHours() + d.getMinutes() / 60;
      for (let i = 0; i < timeSlots.length; i++) {
        if (h >= timeSlots[i].startH && h < timeSlots[i].endH) {
          slotCounts[i]++;
          break;
        }
      }
    });

    const data = timeSlots.map((slot, idx) => ({
      label: slot.label,
      value: slotCounts[idx],
      color: slot.label.includes('พัก') ? '#dc2626' : '#1d4ed8'
    }));

    window.chartEngine.renderBarChart('trendChartContainer', data);
  } else if (mode === 'weekly') {
    // Days of week (Mon-Sun)
    const counts = [0, 0, 0, 0, 0, 0, 0];
    records.forEach(r => {
      const d = new Date(r.datetime);
      const dayIndex = d.getDay(); // 0 is Sun, 1 is Mon
      const adjusted = dayIndex === 0 ? 6 : dayIndex - 1;
      counts[adjusted]++;
    });

    const data = daysOfWeek.map((day, idx) => ({
      label: day,
      value: counts[idx],
      color: idx < 5 ? '#1d4ed8' : '#f59e0b'
    }));

    window.chartEngine.renderBarChart('trendChartContainer', data);
  } else if (mode === 'monthly') {
    // 4 quarters / days chunks of month
    const daysInMonth = 31;
    const chunks = [
      { label: '1-7', count: 0 },
      { label: '8-14', count: 0 },
      { label: '15-21', count: 0 },
      { label: '22-28', count: 0 },
      { label: '29-31', count: 0 }
    ];

    records.forEach(r => {
      const day = new Date(r.datetime).getDate();
      if (day <= 7) chunks[0].count++;
      else if (day <= 14) chunks[1].count++;
      else if (day <= 21) chunks[2].count++;
      else if (day <= 28) chunks[3].count++;
      else chunks[4].count++;
    });

    const data = chunks.map(c => ({
      label: `วันที่ ${c.label}`,
      value: c.count,
      color: '#1d4ed8'
    }));

    window.chartEngine.renderBarChart('trendChartContainer', data);
  } else {
    // Yearly: 12 months
    const monthlyCounts = new Array(12).fill(0);
    records.forEach(r => {
      const m = new Date(r.datetime).getMonth();
      monthlyCounts[m]++;
    });

    const data = thaiMonthsShort.map((m, idx) => ({
      label: m,
      value: monthlyCounts[idx]
    }));

    window.chartEngine.renderLineChart('trendChartContainer', data);
  }
}

function renderSymptomChart(sortedSymptoms) {
  const topItems = sortedSymptoms.slice(0, 5);
  const colors = ['#dc2626', '#1d4ed8', '#0d9488', '#d97706', '#8b5cf6', '#64748b'];

  const data = topItems.map((item, idx) => ({
    label: item[0],
    value: item[1],
    color: colors[idx % colors.length]
  }));

  window.chartEngine.renderDonutChart('symptomChartContainer', data);
}

function renderGradeDistributionChart(records) {
  const grades = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6', 'บุคลากร'];
  const counts = {};
  grades.forEach(g => counts[g] = 0);

  records.forEach(r => {
    if (r.userType === 'student' && r.grade) {
      counts[r.grade] = (counts[r.grade] || 0) + 1;
    } else if (r.userType === 'staff') {
      counts['บุคลากร'] = (counts['บุคลากร'] || 0) + 1;
    }
  });

  const data = grades.map(g => ({
    label: g,
    value: counts[g] || 0,
    color: g.startsWith('ม.1') || g.startsWith('ม.2') || g.startsWith('ม.3')
      ? '#2563eb'
      : g.startsWith('ม.4') || g.startsWith('ม.5') || g.startsWith('ม.6')
        ? '#0d9488'
        : '#d97706'
  }));

  window.chartEngine.renderBarChart('gradeChartContainer', data);
}

function renderClassSummaryTable(records) {
  const container = document.getElementById('classSummaryTableContainer');
  if (!container) return;

  const grades = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];
  let rows = '';

  grades.forEach(grade => {
    const totalRooms = CLASS_CONFIG[grade];
    const gradeRecs = records.filter(r => r.userType === 'student' && r.grade === grade);
    const totalVisits = gradeRecs.length;
    const bedRest = gradeRecs.filter(r => (r.treatment || '').includes('นอนพัก')).length;
    const medDispensed = gradeRecs.filter(r => r.medication && r.medication !== 'ไม่ได้จ่ายยา').length;

    // Room breakdown
    const roomCounts = {};
    gradeRecs.forEach(r => {
      if (r.room) roomCounts[r.room] = (roomCounts[r.room] || 0) + 1;
    });

    let topRoomStr = '-';
    const sortedRooms = Object.entries(roomCounts).sort((a, b) => b[1] - a[1]);
    if (sortedRooms[0]) {
      topRoomStr = `ห้อง ${sortedRooms[0][0]} (${sortedRooms[0][1]} คน)`;
    }

    const hospitalCount = gradeRecs.filter(r => (r.treatment || '').includes('นำส่งโรงพยาบาล')).length;

    rows += `
      <tr>
        <td><strong>${grade}</strong></td>
        <td>${totalRooms} ห้อง</td>
        <td><span class="badge badge-student">${totalVisits} คน</span></td>
        <td>${bedRest} คน</td>
        <td>${hospitalCount > 0 ? `<span class="badge" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;">🚑 ${hospitalCount} คน</span>` : '0 คน'}</td>
        <td>${medDispensed} คน</td>
        <td style="color:#1e3a8a;font-weight:600;">${topRoomStr}</td>
      </tr>
    `;
  });

  // บุคลากร
  const staffRecs = records.filter(r => r.userType === 'staff');
  const staffHospital = staffRecs.filter(r => (r.treatment || '').includes('นำส่งโรงพยาบาล')).length;
  rows += `
    <tr style="background:#fefce8;">
      <td><strong>บุคลากร</strong></td>
      <td>-</td>
      <td><span class="badge badge-staff">${staffRecs.length} คน</span></td>
      <td>${staffRecs.filter(r => (r.treatment || '').includes('นอนพัก')).length} คน</td>
      <td>${staffHospital > 0 ? `<span class="badge" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;">🚑 ${staffHospital} คน</span>` : '0 คน'}</td>
      <td>${staffRecs.filter(r => r.medication && r.medication !== 'ไม่ได้จ่ายยา').length} คน</td>
      <td>-</td>
    </tr>
  `;

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>ระดับชั้น</th>
          <th>จำนวนห้องเรียน</th>
          <th>ผู้ใช้บริการรวม</th>
          <th>นอนพักห้องพยาบาล</th>
          <th>นำส่ง รพ.</th>
          <th>จ่ายยา</th>
          <th>ห้องที่มาใช้บริการมากสุด</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function printStatsReport() {
  const { records, title } = getStatsFilteredRecords();
  const printArea = document.getElementById('printArea');
  if (!printArea) return;

  const totalVisits = records.length;
  const studentVisits = records.filter(r => r.userType === 'student').length;
  const staffVisits = records.filter(r => r.userType === 'staff').length;
  const bedRestCount = records.filter(r => (r.treatment || '').includes('นอนพัก')).length;
  const hospitalCount = records.filter(r => (r.treatment || '').includes('นำส่งโรงพยาบาล')).length;
  const medDispensedCount = records.filter(r => r.medication && r.medication !== 'ไม่ได้จ่ายยา').length;

  printArea.innerHTML = `
    <div class="slip-box" style="max-width:850px;">
      <div class="slip-header">
        <div class="slip-title">
          <h2>รายงานสรุปสถิติการให้บริการห้องพยาบาล</h2>
          <p>โรงเรียนวิสุทธิกษัตรี จังหวัดสมุทรปราการ</p>
          <h3 style="margin-top:6px;font-size:16px;color:#1e3a8a;">${title}</h3>
        </div>
        <img src="assets/logo.jpg" class="slip-logo" alt="ตราโรงเรียน">
      </div>

      <div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:10px;margin-bottom:20px;text-align:center;">
        <div style="border:1px solid #cbd5e1;padding:10px;border-radius:6px;">
          <div style="font-size:12px;color:#64748b;">ผู้รับบริการทั้งหมด</div>
          <div style="font-size:19px;font-weight:bold;color:#1e3a8a;">${totalVisits} ราย</div>
        </div>
        <div style="border:1px solid #cbd5e1;padding:10px;border-radius:6px;">
          <div style="font-size:12px;color:#64748b;">นักเรียน</div>
          <div style="font-size:19px;font-weight:bold;color:#2563eb;">${studentVisits} ราย</div>
        </div>
        <div style="border:1px solid #cbd5e1;padding:10px;border-radius:6px;">
          <div style="font-size:12px;color:#64748b;">บุคลากร</div>
          <div style="font-size:19px;font-weight:bold;color:#d97706;">${staffVisits} ราย</div>
        </div>
        <div style="border:1px solid #cbd5e1;padding:10px;border-radius:6px;">
          <div style="font-size:12px;color:#64748b;">นอนพักฟื้น</div>
          <div style="font-size:19px;font-weight:bold;color:#1e40af;">${bedRestCount} ราย</div>
        </div>
        <div style="border:1px solid #fca5a5;background:#fef2f2;padding:10px;border-radius:6px;">
          <div style="font-size:12px;color:#991b1b;">นำส่งโรงพยาบาล</div>
          <div style="font-size:19px;font-weight:bold;color:#dc2626;">${hospitalCount} ราย</div>
        </div>
      </div>

      <h4 style="margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">สรุปแยกตามระดับชั้น ม.1 - ม.6</h4>
      ${document.getElementById('classSummaryTableContainer').innerHTML}

      <div class="slip-signatures" style="margin-top:45px;">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div style="margin-top:6px;">ลงชื่อ.......................................................</div>
          <div>( ครูเวร / เจ้าหน้าที่ห้องพยาบาล )</div>
          <div style="color:#64748b;font-size:12px;">ผู้จัดทำรายงาน</div>
        </div>

        <div class="sig-box">
          <div class="sig-line"></div>
          <div style="margin-top:6px;">ลงชื่อ.......................................................</div>
          <div>(.......................................................)</div>
          <div style="color:#64748b;font-size:12px;">รองผู้อำนวยการกลุ่มบริหารงานทั่วไป / ผู้อำนวยการ</div>
        </div>
      </div>
    </div>
  `;

  window.print();
}

/* ==========================================================================
   Export to CSV (UTF-8 with BOM for Excel Thai language)
   ========================================================================== */
function exportToCsv() {
  const records = getFilteredRecords();
  if (records.length === 0) {
    showToast('ไม่มีข้อมูลสำหรับส่งออก', 'error');
    return;
  }

  const headers = [
    'ลำดับ',
    'วันที่-เวลา',
    'ประเภท',
    'ชื่อ-นามสกุล',
    'เพศ',
    'ระดับชั้น',
    'ห้อง',
    'เลขที่',
    'ตำแหน่ง(ถ้ามี)',
    'ความดันโลหิต(mmHg)',
    'ชีพจร(ครั้ง/นาที)',
    'SpO2(%)',
    'การหายใจ(ครั้ง/นาที)',
    'อุณหภูมิ(°C)',
    'น้ำตาลในเลือด(mg/dL)',
    'อาการเจ็บป่วย',
    'การรักษา',
    'การจ่ายยา',
    'ผู้บันทึก',
    'หมายเหตุ'
  ];

  const rows = records.map((r, i) => [
    i + 1,
    `"${r.datetime}"`,
    `"${r.userType === 'student' ? 'นักเรียน' : 'บุคลากร'}"`,
    `"${(r.fullName || '').replace(/"/g, '""')}"`,
    `"${r.gender || '-'}"`,
    `"${r.grade || '-'}"`,
    `"${r.room || '-'}"`,
    `"${r.studentNo || '-'}"`,
    `"${(r.position || '').replace(/"/g, '""')}"`,
    `"${r.vitalBp  || '-'}"`,
    `"${r.vitalHr  || '-'}"`,
    `"${r.vitalSpo2 || '-'}"`,
    `"${r.vitalRr  || '-'}"`,
    `"${r.temperature || '-'}"`,
    `"${r.vitalDtx || '-'}"`,
    `"${(r.symptoms || '').replace(/"/g, '""')}"`,
    `"${(r.treatment || '').replace(/"/g, '""')}"`,
    `"${(r.medication || '').replace(/"/g, '""')}"`,
    `"${(r.recordBy || '').replace(/"/g, '""')}"`,
    `"${(r.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `สถิติห้องพยาบาล_วิสุทธิกษัตรี_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`ส่งออกข้อมูล ${records.length} รายการเป็นไฟล์ Excel CSV สำเร็จ`, 'success');
}

/* ==========================================================================
   Backup & Restore (JSON)
   ========================================================================== */
function initBackupRestore() {
  const btnExportJson = document.getElementById('btnExportJson');
  const btnImportJson = document.getElementById('btnImportJson');
  const fileInput = document.getElementById('jsonFileInput');
  const btnLoadDemo = document.getElementById('btnLoadDemoData');
  const btnClearAll = document.getElementById('btnClearAllData');
  const btnSyncToCloud = document.getElementById('btnSyncToCloud');
  const btnPullFromCloud = document.getElementById('btnPullFromCloud');
  const cloudBadge = document.getElementById('cloudStatusBadge');

  if (btnSyncToCloud) {
    btnSyncToCloud.addEventListener('click', syncAllToCloud);
  }

  if (btnPullFromCloud) {
    btnPullFromCloud.addEventListener('click', () => pullRecordsFromCloud(true));
  }

  if (cloudBadge) {
    cloudBadge.addEventListener('click', () => {
      checkCloudflareConnection().then(() => {
        showToast(appState.isCloud ? 'เชื่อมต่อฐานข้อมูล Cloudflare D1 สำเร็จ (ออนไลน์)' : 'ขณะนี้อยู่ในโหมดออฟไลน์ (Local Storage)', appState.isCloud ? 'success' : 'info');
      });
    });
  }

  if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appState.records, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `สำรองข้อมูลห้องพยาบาล_วิสุทธิกษัตรี_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('สำรองข้อมูลเรียบร้อยแล้ว', 'success');
    });
  }

  if (btnImportJson && fileInput) {
    btnImportJson.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (Array.isArray(imported)) {
            if (confirm(`พบข้อมูล ${imported.length} รายการในไฟล์ ต้องการนำเข้าแทนที่ข้อมูลปัจจุบันหรือไม่?`)) {
              appState.records = imported;
              saveRecords();
              renderAll();
              showToast(`นำเข้าข้อมูล ${imported.length} รายการสำเร็จ`, 'success');
            }
          } else {
            showToast('รูปแบบไฟล์ไม่ถูกต้อง', 'error');
          }
        } catch (err) {
          showToast('ไม่สามารถอ่านไฟล์ JSON ได้', 'error');
        }
      };
      reader.readAsText(file);
      fileInput.value = '';
    });
  }

  if (btnLoadDemo) {
    btnLoadDemo.addEventListener('click', () => {
      if (confirm('คุณต้องการโหลดข้อมูลตัวอย่างสำหรับทดสอบระบบหรือไม่? (ข้อมูลตัวอย่างจะถูกเพิ่มเข้าไป)')) {
        loadSampleData(true);
        saveRecords();
        renderAll();
        showToast('โหลดข้อมูลตัวอย่างสำหรับการทดสอบเรียบร้อยแล้ว', 'success');
      }
    });
  }

  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      if (confirm('⚠️ คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลทั้งหมดในระบบ? (แนะนำให้สำรองข้อมูลก่อนทำรายการ)')) {
        if (confirm('ยืนยันอีกครั้งเพื่อล้างข้อมูลทั้งหมด?')) {
          appState.records = [];
          saveRecords();
          renderAll();
          showToast('ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว', 'info');
        }
      }
    });
  }
}

/* ==========================================================================
   Demo Data Generator
   ========================================================================== */
function loadSampleData(append = false) {
  const sampleStudents = [
    { name: 'ด.ช.ธนภัทร สุขสมบูรณ์', grade: 'ม.1', room: '1', no: '5', gender: 'ชาย', sym: 'ปวดศีรษะ, เป็นลม / หน้ามืด / เวียนศีรษะ', treat: 'ให้นอนพักห้องพยาบาล, วัดความดัน/ชีพจร', med: 'พาราเซตามอล 500mg' },
    { name: 'ด.ญ.กัญญารัตน์ วงศ์สว่าง', grade: 'ม.1', room: '3', no: '14', gender: 'หญิง', sym: 'ปวดท้อง, คลื่นไส้ / อาเจียน', treat: 'ประคบร้อน, ให้นอนพักห้องพยาบาล', med: 'ยาธาตุน้ำขาว' },
    { name: 'ด.ช.ณัฐพงศ์ ศรีสุข', grade: 'ม.2', room: '2', no: '8', gender: 'ชาย', sym: 'แผลถลอก / บาดแผล', treat: 'ทำแผล / ล้างแผล / ทายา', med: 'เบตาดีน, แอลกอฮอล์' },
    { name: 'ด.ญ.พิมพ์มาดา รัตนกุล', grade: 'ม.2', room: '5', no: '22', gender: 'หญิง', sym: 'ไข้ / ตัวร้อน', treat: 'เช็ดตัวลดไข้, ให้นอนพักห้องพยาบาล', med: 'พาราเซตามอล 500mg' },
    { name: 'ด.ญ.ปาณิสรา บุญชู', grade: 'ม.3', room: '6', no: '18', gender: 'หญิง', sym: 'ปวดประจำเดือน', treat: 'ประคบร้อน, ให้นอนพักห้องพยาบาล', med: 'พาราเซตามอล 500mg' },
    { name: 'ด.ช.กิตติศักดิ์ ชัยชนะ', grade: 'ม.3', room: '4', no: '2', gender: 'ชาย', sym: 'ข้อเท้าพลิก / ฟกช้ำ', treat: 'ประคบเย็น (Cold pack), พันผ้ายืด Elastic bandage', med: 'ไม่ได้จ่ายยา' },
    { name: 'นายธนกฤต แสงทอง', grade: 'ม.4', room: '2', no: '12', gender: 'ชาย', sym: 'ปวดศีรษะ, เจ็บคอ / ไอ', treat: 'วัดอุณหภูมิร่างกาย', med: 'พาราเซตามอล 500mg, ยาลดน้ำมูก' },
    { name: 'น.ส.อภิญญา มีสุข', grade: 'ม.4', room: '8', no: '25', gender: 'หญิง', sym: 'ผื่นคัน / แพ้', treat: 'ทาคาลาไมน์โลชั่น', med: 'ยาแก้แพ้ คลอเฟนิรามีน' },
    { name: 'นายศุภกิตติ์ มงคล', grade: 'ม.4', room: '11', no: '7', gender: 'ชาย', sym: 'แผลถลอก / บาดแผล', treat: 'ล้างแผล ปิดพลาสเตอร์', med: 'ไม่ได้จ่ายยา' },
    { name: 'น.ส.ชลธิชา มั่นคง', grade: 'ม.5', room: '1', no: '19', gender: 'หญิง', sym: 'เป็นลม / หน้ามืด / เวียนศีรษะ', treat: 'สูดดมแอมโมเนีย, นอนยกขาสูง', med: 'พิมเสนน้ำ' },
    { name: 'นายภูริวัจน์ พุ่มพวง', grade: 'ม.5', room: '7', no: '3', gender: 'ชาย', sym: 'ตาแดง / เคืองตา', treat: 'ล้างตาด้วยน้ำเกลือปราศจากเชื้อ', med: 'ยาหยอดตา' },
    { name: 'น.ส.วริศรา สมใจ', grade: 'ม.5', room: '12', no: '31', gender: 'หญิง', sym: 'ปวดท้อง', treat: 'ให้นอนพักห้องพยาบาล', med: 'ยาธาตุน้ำแดง' },
    { name: 'นายชลธี บุญส่ง', grade: 'ม.6', room: '4', no: '10', gender: 'ชาย', sym: 'ปวดศีรษะ', treat: 'วัดความดันโลหิต', med: 'พาราเซตามอล 500mg' },
    { name: 'น.ส.ปวีณา ดำรงค์', grade: 'ม.6', room: '9', no: '17', gender: 'หญิง', sym: 'ปวดประจำเดือน', treat: 'ประคบร้อน, ให้นอนพักห้องพยาบาล', med: 'พาราเซตามอล 500mg' },
    { name: 'นายธนาธิป สัจจา', grade: 'ม.6', room: '12', no: '6', gender: 'ชาย', sym: 'แมลงสัตว์กัดต่อย', treat: 'ล้างน้ำสะอาด ประคบเย็น', med: 'ยาหม่อง' }
  ];

  const sampleStaff = [
    { name: 'ครูสมศรี ประชากิจ', pos: 'ครูกลุ่มสาระการเรียนรู้คณิตศาสตร์', sym: 'ปวดศีรษะ, ความดันสูง', treat: 'วัดความดันโลหิต, ให้นอนพักห้องพยาบาล', med: 'พาราเซตามอล 500mg' },
    { name: 'นายวิเชียร ยอดรัก', pos: 'เจ้าหน้าที่ธุรการ', sym: 'ปวดท้อง, กรดไหลย้อน', treat: 'แนะนำการปฏิบัติตัว', med: 'ยาลดกรด' },
    { name: 'นางวันเพ็ญ รักษ์ถิ่น', pos: 'พนักงานบริการ / แม่บ้าน', sym: 'แผลถลอก มีดบาด', treat: 'ทำแผล ปิดพลาสเตอร์', med: 'เบตาดีน' }
  ];

  const sampleRecorders = ['ครูพัชรี (ครูเวรพยาบาล)', 'นางสาววิภา (เจ้าหน้าที่พยาบาล)', 'ครูอำไพ (หัวหน้างานพยาบาล)'];

  const now = new Date();
  const generated = [];

  // Generate for past 20 days
  let count = 0;
  for (let d = 0; d < 20; d++) {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() - d);

    // Skip some weekends
    if (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
      if (Math.random() > 0.3) continue;
    }

    const visitsThisDay = Math.floor(Math.random() * 3) + 1;
    for (let v = 0; v < visitsThisDay; v++) {
      const isStudent = Math.random() > 0.15;
      const recTime = new Date(targetDate);
      recTime.setHours(8 + Math.floor(Math.random() * 7), Math.floor(Math.random() * 59));

      if (isStudent) {
        const item = sampleStudents[count % sampleStudents.length];
        generated.push({
          id: 'VK_' + (Date.now() - count * 50000),
          createdAt: recTime.toISOString(),
          datetime: recTime.toISOString(),
          userType: 'student',
          fullName: item.name,
          gender: item.gender,
          grade: item.grade,
          room: item.room,
          studentNo: item.no,
          position: '',
          symptoms: item.sym,
          treatment: item.treat,
          medication: item.med,
          recordBy: sampleRecorders[count % sampleRecorders.length],
          notes: item.treat.includes('นอนพัก') ? 'นอนพัก 1 คาบเรียน อาการดีขึ้นแล้วอนุญาตให้กลับห้อง' : 'ทำแผลและกลับห้องเรียนได้',
          temperature: (36.2 + Math.random() * 1.8).toFixed(1),
          vitalBp: '115/75',
          vitalHr: '78',
          vitalSpo2: '99',
          vitalRr: '18',
          vitalDtx: ''
        });
      } else {
        const item = sampleStaff[count % sampleStaff.length];
        generated.push({
          id: 'VK_' + (Date.now() - count * 50000),
          createdAt: recTime.toISOString(),
          datetime: recTime.toISOString(),
          userType: 'staff',
          fullName: item.name,
          gender: 'หญิง',
          grade: '',
          room: '',
          studentNo: '',
          position: item.pos,
          symptoms: item.sym,
          treatment: item.treat,
          medication: item.med,
          recordBy: sampleRecorders[count % sampleRecorders.length],
          notes: 'มารับบริการช่วงพัก',
          temperature: (36.4 + Math.random() * 0.8).toFixed(1),
          vitalBp: '128/82',
          vitalHr: '74',
          vitalSpo2: '98',
          vitalRr: '16',
          vitalDtx: '95'
        });
      }
      count++;
    }
  }

  if (append) {
    appState.records = [...appState.records, ...generated];
  } else {
    appState.records = generated;
  }
}

/* ==========================================================================
   Helper Utilities
   ========================================================================== */
function renderAll() {
  updateStatsBadge();
  renderTable();
  if (appState.activeTab === 'stats') {
    renderStatistics();
  }
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
    <div>${escapeHtml(message)}</div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

function formatThaiDateTime(isoStr) {
  if (!isoStr) return { date: '-', time: '-' };
  const d = new Date(isoStr);
  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const day = d.getDate();
  const month = thaiMonths[d.getMonth()];
  const year = d.getFullYear() + 543;
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return {
    date: `${day} ${month} ${year}`,
    time: `${h}:${m}`
  };
}

function formatThaiMonth(mIndex) {
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  return thaiMonths[mIndex] || '';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

/* ==========================================================================
   Authentication System (Admin / 1234)
   ========================================================================== */
function initAuth() {
  const loginOverlay = document.getElementById('loginOverlay');
  const loginCard = document.getElementById('loginCard');
  const loginForm = document.getElementById('loginForm');
  const loginErrorMsg = document.getElementById('loginErrorMsg');
  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');
  const btnTogglePw = document.getElementById('btnTogglePassword');
  const userBadge = document.getElementById('headerUserBadge');
  const userNameDisplay = document.getElementById('headerUserName');
  const btnLogout = document.getElementById('btnLogout');

  // Check existing session
  const currentUser = sessionStorage.getItem(AUTH_KEY);
  if (currentUser) {
    if (loginOverlay) loginOverlay.style.display = 'none';
    if (userBadge) userBadge.style.display = 'flex';
    if (userNameDisplay) userNameDisplay.textContent = currentUser;
  } else {
    if (loginOverlay) loginOverlay.style.display = 'flex';
    if (userBadge) userBadge.style.display = 'none';
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (usernameInput) setTimeout(() => usernameInput.focus(), 250);
  }

  // Toggle password visibility
  if (btnTogglePw && passwordInput) {
    btnTogglePw.addEventListener('click', () => {
      const isPw = passwordInput.type === 'password';
      passwordInput.type = isPw ? 'text' : 'password';
      btnTogglePw.textContent = isPw ? '🙈' : '👁️';
    });
  }

  // Login form submission
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = (usernameInput.value || '').trim();
      const pass = (passwordInput.value || '').trim();

      // Check User: Admin, Password: 1234 (Case-insensitive username)
      if (user.toLowerCase() === 'admin' && pass === '1234') {
        sessionStorage.setItem(AUTH_KEY, 'Admin');
        if (loginErrorMsg) loginErrorMsg.style.display = 'none';
        if (loginOverlay) loginOverlay.style.display = 'none';
        if (userBadge) userBadge.style.display = 'flex';
        if (userNameDisplay) userNameDisplay.textContent = 'Admin';

        // Auto fill recorder name if empty
        const recordBy = document.getElementById('recordBy');
        if (recordBy && !recordBy.value) {
          recordBy.value = 'Admin (เจ้าหน้าที่ห้องพยาบาล)';
        }

        showToast('เข้าสู่ระบบสำเร็จ ยินดีต้อนรับผู้ดูแลระบบ Admin', 'success');
      } else {
        if (loginErrorMsg) loginErrorMsg.style.display = 'flex';
        if (loginCard) {
          loginCard.classList.remove('shake');
          void loginCard.offsetWidth; // Force reflow
          loginCard.classList.add('shake');
        }
        if (passwordInput) {
          passwordInput.value = '';
          passwordInput.focus();
        }
        showToast('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง', 'error');
      }
    });
  }

  // Logout action
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (confirm('คุณต้องการออกจากระบบห้องพยาบาลใช่หรือไม่?')) {
        sessionStorage.removeItem(AUTH_KEY);
        if (userBadge) userBadge.style.display = 'none';
        if (loginOverlay) {
          loginOverlay.style.display = 'flex';
          if (passwordInput) passwordInput.value = '';
          if (loginErrorMsg) loginErrorMsg.style.display = 'none';
          if (passwordInput) passwordInput.focus();
        }
        showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
      }
    });
  }
}

/* ==========================================================================
   Cloudflare D1 & Desktop App (PWA) Integration
   ========================================================================== */

async function initCloudSync() {
  // 1. Register Service Worker for Offline Caching and PWA
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
      console.log('Service Worker registered successfully');
    } catch (e) {
      console.log('Service Worker registration skipped/failed:', e);
    }
  }

  // 2. Handle PWA Desktop App Installation
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    appState.deferredInstallPrompt = e;
    const btnHeader = document.getElementById('btnInstallApp');
    const btnTab = document.getElementById('btnTabInstallApp');
    if (btnHeader) btnHeader.style.display = 'inline-flex';
    if (btnTab) btnTab.style.display = 'inline-flex';
  });

  const triggerInstall = async () => {
    if (appState.deferredInstallPrompt) {
      appState.deferredInstallPrompt.prompt();
      const { outcome } = await appState.deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast('ติดตั้งแอปพลิเคชันห้องพยาบาลสำเร็จแล้ว!', 'success');
        const btnHeader = document.getElementById('btnInstallApp');
        const btnTab = document.getElementById('btnTabInstallApp');
        if (btnHeader) btnHeader.style.display = 'none';
        if (btnTab) btnTab.style.display = 'none';
      }
      appState.deferredInstallPrompt = null;
    } else {
      alert('หากหน้าต่างติดตั้งอัตโนมัติไม่ปรากฏ ท่านสามารถ:\n\n1. คลิกปุ่ม "..." หรือ "เมนู" ที่มุมขวาบนของเบราว์เซอร์\n2. เลือก "แอป" (Apps) -> "ติดตั้งหน้านี้เป็นแอป" (Install this site as an app)\n3. หรือดับเบิลคลิกไฟล์ "สร้างไอคอนแอปบนเดสก์ท็อป.bat" เพื่อสร้างทางลัดเข้าใช้งานได้ทันที');
    }
  };

  const btnHeader = document.getElementById('btnInstallApp');
  if (btnHeader) btnHeader.addEventListener('click', triggerInstall);
  const btnTab = document.getElementById('btnTabInstallApp');
  if (btnTab) btnTab.addEventListener('click', triggerInstall);

  const btnGuide = document.getElementById('btnOpenDesktopGuide');
  if (btnGuide) {
    btnGuide.addEventListener('click', () => {
      alert('📌 วิธีเปิด/ติดตั้งเป็นแอปพลิเคชันบน Desktop:\n\n1. เข้าไปที่โฟลเดอร์ระบบ\n2. ดับเบิลคลิกไฟล์ "สร้างไอคอนแอปบนเดสก์ท็อป.bat"\n3. ไอคอน "ระบบห้องพยาบาล โรงเรียนวิสุทธิกษัตรี" จะปรากฏบนหน้าจอ Desktop ทันที\n4. สามารถเปิดใช้งานได้ตลอดเวลา เสมือนโปรแกรม Windows แท้ๆ');
    });
  }

  // 3. Auto-detect online/offline network events
  window.addEventListener('online', () => {
    checkCloudflareConnection().then(() => {
      showToast('เชื่อมต่ออินเทอร์เน็ตแล้ว ตรวจสอบสถานะคลาวด์...', 'info');
    });
  });

  window.addEventListener('offline', () => {
    appState.isCloud = false;
    const badgeDot = document.getElementById('cloudStatusDot');
    const badgeText = document.getElementById('cloudStatusText');
    const tabStatus = document.getElementById('tabCloudStatusText');
    if (badgeDot) badgeDot.className = 'status-dot offline';
    if (badgeText) badgeText.textContent = 'โหมดออฟไลน์';
    if (tabStatus) {
      tabStatus.textContent = '🟠 โหมดออฟไลน์ (ใช้งาน Local Storage)';
      tabStatus.style.background = '#ffedd5';
      tabStatus.style.color = '#c2410c';
    }
    showToast('การเชื่อมต่ออินเทอร์เน็ตขัดข้อง สลับไปใช้โหมดออฟไลน์ในเครื่อง', 'warning');
  });

  // 4. Initial check for Cloudflare D1
  await checkCloudflareConnection();
}

async function checkCloudflareConnection() {
  const badgeDot = document.getElementById('cloudStatusDot');
  const badgeText = document.getElementById('cloudStatusText');
  const tabStatus = document.getElementById('tabCloudStatusText');

  try {
    const res = await fetch('./api/records?limit=1', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        appState.isCloud = true;
        if (badgeDot) badgeDot.className = 'status-dot online';
        if (badgeText) badgeText.textContent = 'Cloud D1 ออนไลน์';
        if (tabStatus) {
          tabStatus.textContent = '🟢 ออนไลน์ (เชื่อมต่อ Cloudflare D1 สำเร็จ)';
          tabStatus.style.background = '#dcfce7';
          tabStatus.style.color = '#15803d';
        }
        // Auto-pull on cloud connect
        await pullRecordsFromCloud(false);
        return;
      }
    }
    throw new Error('API not available');
  } catch (e) {
    appState.isCloud = false;
    if (badgeDot) badgeDot.className = 'status-dot offline';
    if (badgeText) badgeText.textContent = 'โหมดออฟไลน์';
    if (tabStatus) {
      tabStatus.textContent = '🟠 โหมดออฟไลน์ (ใช้งาน Local Storage)';
      tabStatus.style.background = '#ffedd5';
      tabStatus.style.color = '#c2410c';
    }
  }
}

async function sendRecordToCloud(record) {
  try {
    const res = await fetch('./api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    if (res.ok) {
      console.log('Record synced to Cloudflare D1 successfully');
    }
  } catch (e) {
    console.warn('Failed to send record to Cloudflare D1:', e);
  }
}

async function updateRecordOnCloud(record) {
  try {
    await fetch(`./api/records/${encodeURIComponent(record.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
  } catch (e) {
    console.warn('Failed to update record on Cloudflare D1:', e);
  }
}

async function deleteRecordOnCloud(id) {
  try {
    await fetch(`./api/records/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  } catch (e) {
    console.warn('Failed to delete record on Cloudflare D1:', e);
  }
}

async function pullRecordsFromCloud(showNotification = true) {
  try {
    const res = await fetch('./api/records?limit=5000', { cache: 'no-store' });
    if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูลจาก Cloudflare ได้');
    const data = await res.json();
    if (data && data.success && Array.isArray(data.records)) {
      if (data.records.length > 0) {
        appState.records = data.records;
        saveRecords();
        renderAll();
        if (showNotification) {
          showToast(`ดาวน์โหลดข้อมูล ${data.records.length} รายการจาก Cloudflare D1 สำเร็จ`, 'success');
        }
      } else if (showNotification) {
        showToast('ฐานข้อมูลบน Cloudflare D1 ยังไม่มีรายการบันทึก', 'info');
      }
    }
  } catch (e) {
    if (showNotification) {
      showToast(`การโหลดข้อมูลล้มเหลว: ${e.message}`, 'error');
    }
  }
}

async function syncAllToCloud() {
  if (appState.records.length === 0) {
    showToast('ไม่มีข้อมูลในเครื่องสำหรับซิงก์', 'info');
    return;
  }

  showToast('กำลังซิงก์ข้อมูลขึ้นสู่ Cloudflare D1...', 'info');
  try {
    const res = await fetch('./api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: appState.records })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`ซิงก์ข้อมูล ${data.syncedCount} รายการขึ้น Cloudflare D1 เรียบร้อยแล้ว!`, 'success');
      await checkCloudflareConnection();
    } else {
      throw new Error(data.error || 'Sync request failed');
    }
  } catch (e) {
    showToast(`การซิงก์ล้มเหลว: ${e.message}`, 'error');
  }
}
