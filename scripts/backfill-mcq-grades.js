require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lms_database',
  });

  const [subs] = await c.query(
    'SELECT s.id, s.content, a.questions, a.max_points FROM submissions s JOIN assignments a ON s.assignment_id = a.id WHERE s.grade IS NULL AND a.questions IS NOT NULL'
  );

  let graded = 0;
  for (const sub of subs) {
    try {
      const questions = typeof sub.questions === 'string' ? JSON.parse(sub.questions) : sub.questions;
      const answers = typeof sub.content === 'string' ? JSON.parse(sub.content) : sub.content;
      if (!Array.isArray(questions) || !answers) continue;

      const mcq = questions.filter(q => q.correctOption != null);
      if (mcq.length === 0) continue;

      let totalPts = 0, earnedPts = 0, correct = 0, wrong = 0;
      for (const q of mcq) {
        const pts = Number(q.points) || 10;
        totalPts += pts;
        if (answers[q.id] != null && Number(answers[q.id]) === Number(q.correctOption)) {
          earnedPts += pts;
          correct++;
        } else {
          wrong++;
        }
      }

      const pct = totalPts > 0 ? Math.round((earnedPts / totalPts) * 100) : 0;
      const feedback = `Auto-graded: ${correct} correct, ${wrong} incorrect. Score: ${earnedPts}/${totalPts} (${pct}%).`;

      await c.query('UPDATE submissions SET grade=?, feedback=?, graded_at=NOW(), graded_by=NULL WHERE id=?', [pct, feedback, sub.id]);
      graded++;
      console.log(`  Graded submission ${sub.id}: ${pct}%`);
    } catch (e) {
      console.error(`  Skip sub ${sub.id}:`, e.message);
    }
  }

  console.log(`\nBackfilled ${graded}/${subs.length} ungraded MCQ submissions.`);
  await c.end();
}

main();
