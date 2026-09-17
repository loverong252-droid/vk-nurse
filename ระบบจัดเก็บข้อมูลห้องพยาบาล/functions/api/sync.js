/**
 * Cloudflare Pages Function: /api/sync
 * POST: นำเข้า/ซิงก์ข้อมูลจาก Local Storage ขึ้นสู่ Cloudflare D1 (Batch Upsert)
 */

const jsonResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

export async function onRequestPost({ env, request }) {
  if (!env.DB) {
    return jsonResponse({ error: 'Database binding "DB" not found' }, 503);
  }

  try {
    const { records } = await request.json();
    if (!Array.isArray(records) || records.length === 0) {
      return jsonResponse({ error: 'No records array provided' }, 400);
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
      ON CONFLICT(id) DO UPDATE SET
        datetime = excluded.datetime,
        user_type = excluded.user_type,
        full_name = excluded.full_name,
        gender = excluded.gender,
        grade = excluded.grade,
        room = excluded.room,
        student_no = excluded.student_no,
        position = excluded.position,
        symptoms = excluded.symptoms,
        treatment = excluded.treatment,
        medication = excluded.medication,
        record_by = excluded.record_by,
        notes = excluded.notes,
        temperature = excluded.temperature,
        vital_bp = excluded.vital_bp,
        vital_hr = excluded.vital_hr,
        vital_spo2 = excluded.vital_spo2,
        vital_rr = excluded.vital_rr,
        vital_dtx = excluded.vital_dtx,
        updated_at = CURRENT_TIMESTAMP
    `;

    const statements = records.map(r => {
      const id = r.id || `VK_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const createdAt = r.createdAt || new Date().toISOString();
      const datetime = r.datetime || createdAt;
      const userType = r.userType || 'student';
      const fullName = (r.fullName || '').trim();
      const gender = r.gender || 'ไม่ระบุ';
      const grade = r.grade || '';
      const room = r.room || '';
      const studentNo = r.studentNo || '';
      const position = r.position || '';
      const symptoms = (r.symptoms || '').trim();
      const treatment = (r.treatment || 'ให้คำแนะนำและสังเกตอาการ').trim();
      const medication = (r.medication || 'ไม่ได้จ่ายยา').trim();
      const recordBy = (r.recordBy || '').trim();
      const notes = (r.notes || '').trim();
      const temperature = (r.temperature || '').toString();
      const vitalBp = (r.vitalBp || '').toString();
      const vitalHr = (r.vitalHr || '').toString();
      const vitalSpo2 = (r.vitalSpo2 || '').toString();
      const vitalRr = (r.vitalRr || '').toString();
      const vitalDtx = (r.vitalDtx || '').toString();

      return env.DB.prepare(query).bind(
        id, createdAt, datetime, userType, fullName, gender,
        grade, room, studentNo, position, symptoms, treatment,
        medication, recordBy, notes, temperature,
        vitalBp, vitalHr, vitalSpo2, vitalRr, vitalDtx
      );
    });

    // Cloudflare D1 batch execution
    await env.DB.batch(statements);

    return jsonResponse({ success: true, syncedCount: records.length });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}
