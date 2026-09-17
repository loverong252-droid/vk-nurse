/**
 * Cloudflare Pages Function: /api/records/:id
 * PUT: แก้ไขข้อมูลประวัติ
 * DELETE: ลบข้อมูลประวัติ
 */

const jsonResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

export async function onRequestPut({ env, request, params }) {
  if (!env.DB) {
    return jsonResponse({ error: 'Database binding "DB" not found' }, 503);
  }

  try {
    const id = params.id;
    const data = await request.json();

    const query = `
      UPDATE nurse_records SET
        datetime = ?, user_type = ?, full_name = ?, gender = ?,
        grade = ?, room = ?, student_no = ?, position = ?,
        symptoms = ?, treatment = ?, medication = ?, record_by = ?,
        notes = ?, temperature = ?,
        vital_bp = ?, vital_hr = ?, vital_spo2 = ?, vital_rr = ?, vital_dtx = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await env.DB.prepare(query).bind(
      data.datetime, data.userType, data.fullName, data.gender || 'ไม่ระบุ',
      data.grade || '', data.room || '', data.studentNo || '', data.position || '',
      data.symptoms, data.treatment, data.medication, data.recordBy,
      data.notes || '', (data.temperature || '').toString(),
      (data.vitalBp || '').toString(), (data.vitalHr || '').toString(),
      (data.vitalSpo2 || '').toString(), (data.vitalRr || '').toString(), (data.vitalDtx || '').toString(),
      id
    ).run();

    return jsonResponse({ success: true, updated: id });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

export async function onRequestDelete({ env, params }) {
  if (!env.DB) {
    return jsonResponse({ error: 'Database binding "DB" not found' }, 503);
  }

  try {
    const id = params.id;
    await env.DB.prepare('DELETE FROM nurse_records WHERE id = ?').bind(id).run();
    return jsonResponse({ success: true, deleted: id });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}
