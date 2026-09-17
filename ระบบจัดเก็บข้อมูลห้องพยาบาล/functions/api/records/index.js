/**
 * Cloudflare Pages Function: /api/records
 * GET: ดึงรายการบันทึกทั้งหมดจาก Cloudflare D1
 * POST: บันทึกข้อมูลการเข้าใช้บริการใหม่ลง D1
 */

const jsonResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

export async function onRequestGet({ env, request }) {
  if (!env.DB) {
    return jsonResponse({
      error: 'Cloudflare D1 Database binding "DB" is not configured in Pages Settings.',
      fallbackToLocal: true
    }, 503);
  }

  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '5000', 10);
    const search = (url.searchParams.get('search') || '').trim();

    let query = 'SELECT * FROM nurse_records';
    let params = [];

    if (search) {
      query += ` WHERE full_name LIKE ? OR symptoms LIKE ? OR treatment LIKE ? OR grade LIKE ? OR record_by LIKE ?`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    query += ' ORDER BY datetime DESC LIMIT ?';
    params.push(limit);

    const stmt = env.DB.prepare(query).bind(...params);
    const { results } = await stmt.all();

    // Map DB column names to frontend camelCase properties
    const records = (results || []).map(row => ({
      id: row.id,
      createdAt: row.created_at,
      datetime: row.datetime,
      userType: row.user_type,
      fullName: row.full_name,
      gender: row.gender || 'ไม่ระบุ',
      grade: row.grade || '',
      room: row.room || '',
      studentNo: row.student_no || '',
      position: row.position || '',
      symptoms: row.symptoms,
      treatment: row.treatment,
      medication: row.medication,
      recordBy: row.record_by,
      notes: row.notes || '',
      temperature: row.temperature || '',
      vitalBp: row.vital_bp || '',
      vitalHr: row.vital_hr || '',
      vitalSpo2: row.vital_spo2 || '',
      vitalRr: row.vital_rr || '',
      vitalDtx: row.vital_dtx || ''
    }));

    return jsonResponse({ success: true, count: records.length, records });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

export async function onRequestPost({ env, request }) {
  if (!env.DB) {
    return jsonResponse({ error: 'Database binding "DB" not found' }, 503);
  }

  try {
    const data = await request.json();
    const id = data.id || `VK_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const createdAt = data.createdAt || new Date().toISOString();
    const datetime = data.datetime || createdAt;
    const userType = data.userType || 'student';
    const fullName = (data.fullName || '').trim();
    const gender = data.gender || 'ไม่ระบุ';
    const grade = data.grade || '';
    const room = data.room || '';
    const studentNo = data.studentNo || '';
    const position = data.position || '';
    const symptoms = (data.symptoms || '').trim();
    const treatment = (data.treatment || 'ให้คำแนะนำและสังเกตอาการ').trim();
    const medication = (data.medication || 'ไม่ได้จ่ายยา').trim();
    const recordBy = (data.recordBy || '').trim();
    const notes = (data.notes || '').trim();
    const temperature = (data.temperature || '').toString();
    const vitalBp = (data.vitalBp || '').toString();
    const vitalHr = (data.vitalHr || '').toString();
    const vitalSpo2 = (data.vitalSpo2 || '').toString();
    const vitalRr = (data.vitalRr || '').toString();
    const vitalDtx = (data.vitalDtx || '').toString();

    if (!fullName || !symptoms) {
      return jsonResponse({ error: 'Missing required fields (fullName, symptoms)' }, 400);
    }

    const query = `
      INSERT INTO nurse_records (
        id, created_at, datetime, user_type, full_name, gender,
        grade, room, student_no, position, symptoms, treatment,
        medication, record_by, notes, temperature,
        vital_bp, vital_hr, vital_spo2, vital_rr, vital_dtx, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
      )
    `;

    await env.DB.prepare(query).bind(
      id, createdAt, datetime, userType, fullName, gender,
      grade, room, studentNo, position, symptoms, treatment,
      medication, recordBy, notes, temperature,
      vitalBp, vitalHr, vitalSpo2, vitalRr, vitalDtx
    ).run();

    const newRecord = {
      id, createdAt, datetime, userType, fullName, gender,
      grade, room, studentNo, position, symptoms, treatment,
      medication, recordBy, notes, temperature,
      vitalBp, vitalHr, vitalSpo2, vitalRr, vitalDtx
    };

    return jsonResponse({ success: true, record: newRecord }, 201);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}
