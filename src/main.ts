import './style.css'
import * as XLSX from '@e965/xlsx'

interface Grade {
  code: string
  student: string
  assessment: string
  date: string
  score: number
  maximum: number
}

type Mode = 'student' | 'manager'

const demoGrades: Grade[] = [
  { code: 'ELEVE-2048', student: 'Aïcha Martin', assessment: 'Contrôle de fractions', date: '12/11/2026', score: 16, maximum: 20 },
  { code: 'ELEVE-2048', student: 'Aïcha Martin', assessment: 'Exposé : les énergies', date: '05/11/2026', score: 18, maximum: 20 },
  { code: 'ELEVE-2048', student: 'Aïcha Martin', assessment: 'Évaluation de vocabulaire', date: '28/10/2026', score: 14, maximum: 20 },
  { code: 'ELEVE-1032', student: 'Noah Bernard', assessment: 'Contrôle de fractions', date: '12/11/2026', score: 13, maximum: 20 },
  { code: 'ELEVE-1032', student: 'Noah Bernard', assessment: 'Exposé : les énergies', date: '05/11/2026', score: 15, maximum: 20 },
]

let grades = [...demoGrades]
let mode: Mode = 'student'
let activeCode: string | null = null
let managerAuthenticated = false
let notice = ''
let noticeKind: 'success' | 'error' = 'success'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Élément principal introuvable.')
}

app.innerHTML = `
  <div class="page-shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Notes de classe, accueil">
        <span class="brand-mark" aria-hidden="true">n.</span>
        <span>notes<span class="brand-light">declasse</span></span>
      </a>
      <div class="prototype-pill"><span></span> Prototype de démonstration</div>
      <nav class="mode-switch" aria-label="Choisir un espace">
        <button class="mode-button is-active" data-mode="student" type="button">Espace élève</button>
        <button class="mode-button" data-mode="manager" type="button">Responsable</button>
      </nav>
    </header>
    <main id="content"></main>
    <footer class="footer">
      <span>Un suivi simple, pour apprendre sereinement.</span>
      <span><span class="footer-dot"></span> Espace de démonstration</span>
    </footer>
  </div>
`

const content = document.querySelector<HTMLElement>('#content')

if (!content) {
  throw new Error('Zone de contenu introuvable.')
}
const pageContent = content

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character] ?? character
  })
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)
}

function getLatestDate(items: Grade[]): string {
  const parsedDates = items.map((grade) => {
    const frenchDate = grade.date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    const timestamp = frenchDate
      ? Date.UTC(Number(frenchDate[3]), Number(frenchDate[2]) - 1, Number(frenchDate[1]))
      : Date.parse(grade.date)
    return { date: grade.date, timestamp }
  }).filter((entry) => Number.isFinite(entry.timestamp))

  parsedDates.sort((first, second) => second.timestamp - first.timestamp)
  return parsedDates[0]?.date ?? '—'
}

function renderStudent(): string {
  if (!activeCode) {
    return `
      <section class="intro">
        <div class="eyebrow"><span class="eyebrow-line"></span> LE CARNET DE NOTES, ENFIN SIMPLIFIÉ</div>
        <h1>Tes efforts<br />méritent d’être <span>vus.</span></h1>
        <p class="intro-copy">Retrouve tes résultats d’évaluation en un clin d’œil. Ton espace est personnel et accessible avec ton code élève.</p>
        <div class="student-card">
          <div class="card-icon student-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"/></svg>
          </div>
          <div>
            <h2>Mon espace élève</h2>
            <p>Entre le code qui t’a été remis par ton responsable.</p>
          </div>
          <form id="login-form" class="login-form">
            <label for="student-code">Ton code élève</label>
            <div class="input-wrap">
              <span class="input-symbol" aria-hidden="true">#</span>
              <input id="student-code" name="code" autocomplete="off" placeholder="Ex. ELEVE-2048" required />
            </div>
            <button class="primary-button" type="submit">Voir mes résultats <span aria-hidden="true">→</span></button>
            <button class="demo-link" id="demo-login" type="button">Essayer avec un code de démonstration</button>
            <div id="login-message" class="form-message" role="status" aria-live="polite"></div>
          </form>
        </div>
        <div class="privacy-note"><span class="lock-icon" aria-hidden="true">⌑</span><span><strong>Tes résultats restent personnels.</strong> Ne partage pas ton code avec tes camarades.</span></div>
      </section>
      <aside class="visual-card" aria-label="Aperçu du suivi des résultats">
        <div class="visual-orbit orbit-one"></div>
        <div class="visual-orbit orbit-two"></div>
        <div class="visual-label"><span class="live-dot"></span> TON PARCOURS SCOLAIRE</div>
        <div class="floating-note note-top"><span class="note-icon">✳</span><span><strong>Un pas après l’autre</strong><small>Chaque progrès compte</small></span></div>
        <div class="grade-preview">
          <div class="preview-header"><span>RÉSULTAT RÉCENT</span><span class="preview-check">✓</span></div>
          <div class="preview-subject">Mathématiques</div>
          <div class="preview-grade">16<span>/20</span></div>
          <div class="preview-progress"><span></span></div>
          <div class="preview-footer"><span>Contrôle de fractions</span><span>12 nov.</span></div>
        </div>
        <div class="floating-note note-bottom"><span class="sparkle">✦</span><span><strong>Continue comme ça !</strong><small>Tu es sur la bonne voie</small></span></div>
        <div class="visual-caption">Tes notes, à portée de main.</div>
      </aside>
    `
  }

  const studentGrades = grades.filter((grade) => grade.code.toLocaleUpperCase() === activeCode)
  const studentName = studentGrades[0]?.student ?? ''
  const totalScore = studentGrades.reduce((sum, grade) => sum + grade.score, 0)
  const totalMaximum = studentGrades.reduce((sum, grade) => sum + grade.maximum, 0)
  const average = totalMaximum > 0 ? (totalScore / totalMaximum) * 20 : 0
  const latest = studentGrades[0]

  return `
    <section class="results-page">
      <div class="results-heading">
        <div>
          <div class="eyebrow"><span class="eyebrow-line"></span> TON ESPACE PERSONNEL</div>
          <h1>Bonjour, <span>${escapeHtml(studentName.split(' ')[0])}.</span></h1>
          <p>Voici le récapitulatif de tes évaluations.</p>
        </div>
        <button class="text-button" id="logout" type="button">Changer de code <span aria-hidden="true">↗</span></button>
      </div>
      <div class="summary-grid">
        <article class="summary-card summary-primary">
          <div class="summary-label">MOYENNE GÉNÉRALE</div>
          <div class="summary-value">${formatNumber(average)}<span>/20</span></div>
          <div class="summary-foot"><span class="summary-check">✓</span> Continue tes efforts, tu progresses !</div>
          <div class="summary-decoration" aria-hidden="true">✳</div>
        </article>
        <article class="summary-card">
          <div class="summary-label">ÉVALUATIONS</div>
          <div class="summary-value">${studentGrades.length}<span> au total</span></div>
          <div class="summary-foot">Résultats enregistrés dans ton espace</div>
        </article>
        <article class="summary-card">
          <div class="summary-label">DERNIÈRE NOTE</div>
          <div class="summary-value">${latest ? `${formatNumber(latest.score)}<span>/${formatNumber(latest.maximum)}</span>` : '—'}</div>
          <div class="summary-foot">${latest ? escapeHtml(latest.assessment) : 'Aucune évaluation pour le moment'}</div>
        </article>
      </div>
      <section class="table-card">
        <div class="table-heading"><div><h2>Mes évaluations</h2><p>Un aperçu de ton travail en classe</p></div><span class="count-pill">${studentGrades.length} résultat${studentGrades.length === 1 ? '' : 's'}</span></div>
        <div class="table-scroll">
          <table>
            <thead><tr><th>ÉVALUATION</th><th>DATE</th><th>RÉSULTAT</th><th>APPRÉCIATION</th></tr></thead>
            <tbody>
              ${studentGrades.map((grade) => {
                const percentage = (grade.score / grade.maximum) * 100
                const appreciation = percentage >= 80 ? 'Très bien' : percentage >= 60 ? 'Bien' : 'À poursuivre'
                const tone = percentage >= 80 ? 'green' : percentage >= 60 ? 'blue' : 'amber'
                return `<tr><td><strong>${escapeHtml(grade.assessment)}</strong><small>${escapeHtml(grade.student)}</small></td><td>${escapeHtml(grade.date)}</td><td><strong class="grade-number">${formatNumber(grade.score)}<span>/${formatNumber(grade.maximum)}</span></strong></td><td><span class="result-badge ${tone}">${appreciation}</span></td></tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="table-footnote"><span class="info-icon">i</span> Pour toute question sur un résultat, rapproche-toi de ton responsable de classe.</div>
      </section>
      <div class="privacy-note results-privacy"><span class="lock-icon" aria-hidden="true">⌑</span><span><strong>Code utilisé : ${escapeHtml(activeCode)}</strong> · Garde-le confidentiel.</span></div>
    </section>
  `
}

function renderManager(): string {
  const studentCount = new Set(grades.map((grade) => grade.code)).size
  return `
    <section class="manager-page">
      <div class="manager-heading">
        <div class="eyebrow"><span class="eyebrow-line"></span> OUTILS DE GESTION</div>
        <h1>Bonjour, <span>responsable.</span></h1>
        <p>Importe les résultats de la classe pour les rendre accessibles aux élèves.</p>
        <button class="manager-logout" id="manager-logout" type="button">Verrouiller l’espace <span aria-hidden="true">↗</span></button>
      </div>
      <div class="prototype-warning"><span class="warning-icon">!</span><div><strong>Version de démonstration</strong><span>Les fichiers sont lus dans ce navigateur uniquement. Rien n’est envoyé ni enregistré. N’importe pas de vraies notes dans ce prototype.</span></div></div>
      ${notice ? `<div class="notice ${noticeKind}" role="status">${escapeHtml(notice)}</div>` : ''}
      <div class="manager-grid">
        <section class="upload-card">
          <div class="card-icon upload-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5"/></svg></div>
          <h2>Importer un fichier Excel</h2>
          <p>Ajoute ou remplace les résultats de démonstration avec un classeur de ta classe.</p>
          <label class="dropzone" for="workbook">
            <span class="upload-symbol" aria-hidden="true">↑</span>
            <strong>Choisir un fichier à importer</strong>
            <span>Formats acceptés : .xlsx, .xls (10 Mo max.)</span>
            <input id="workbook" type="file" accept=".xlsx,.xls,.xlsm" />
          </label>
          <button class="template-button" id="download-template" type="button"><span aria-hidden="true">↓</span> Télécharger le modèle Excel</button>
          <div id="import-message" class="form-message" role="status" aria-live="polite"></div>
        </section>
        <section class="instructions-card">
          <div class="instruction-heading"><div><span class="step-number">01</span><h2>Prépare ton tableau</h2></div><span class="spreadsheet-mark">XLS</span></div>
          <p>La première ligne doit contenir ces colonnes. Les noms peuvent être adaptés en gardant le même sens.</p>
          <div class="column-list">
            <div><span>Code élève</span><span>Identifiant unique</span><b>Requis</b></div>
            <div><span>Nom</span><span>Prénom et nom</span><b>Requis</b></div>
            <div><span>Évaluation</span><span>Intitulé du devoir</span><b>Requis</b></div>
            <div><span>Date</span><span>Date de l’évaluation</span><b>Requis</b></div>
            <div><span>Note / Sur</span><span>Ex. 15 / 20</span><b>Requis</b></div>
          </div>
          <div class="instruction-tip"><span aria-hidden="true">✦</span> Une ligne par élève et par évaluation. Le code élève doit rester identique sur chaque ligne.</div>
        </section>
      </div>
      <section class="import-summary">
        <div class="summary-heading"><div><span class="eyebrow"><span class="eyebrow-line"></span> APERÇU EN MÉMOIRE</span><h2>Jeu de données chargé</h2></div><span class="memory-tag"><span></span> Non enregistré</span></div>
        <div class="summary-stats"><div><strong>${grades.length}</strong><span>résultats</span></div><div><strong>${studentCount}</strong><span>codes élèves</span></div><div><strong>${escapeHtml(getLatestDate(grades))}</strong><span>date la plus récente</span></div></div>
        <div class="preview-list">${grades.slice(0, 4).map((grade) => `<div class="preview-row"><span><strong>${escapeHtml(grade.student)}</strong><small>${escapeHtml(grade.assessment)}</small></span><span>${escapeHtml(grade.code)}</span><strong>${formatNumber(grade.score)} / ${formatNumber(grade.maximum)}</strong></div>`).join('')}${grades.length > 4 ? `<div class="preview-more">+ ${grades.length - 4} autres résultats</div>` : ''}</div>
      </section>
    </section>
  `
}

function renderManagerLogin(): string {
  return `
    <section class="manager-login-page">
      <div class="manager-login-card">
        <div class="card-icon manager-login-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3m-12 0h14v11H5z"/><path d="M12 14v3"/></svg>
        </div>
        <div class="eyebrow"><span class="eyebrow-line"></span> ACCÈS RÉSERVÉ</div>
        <h1>Espace <span>responsable.</span></h1>
        <p>Cette partie est réservée au responsable de classe. Entre le code d’accès pour continuer.</p>
        <form id="manager-login-form" class="login-form">
          <label for="manager-code">Code responsable</label>
          <div class="input-wrap">
            <span class="input-symbol" aria-hidden="true">⌑</span>
            <input id="manager-code" name="code" type="password" autocomplete="current-password" placeholder="Ton code d’accès" required />
          </div>
          <button class="primary-button" type="submit">Accéder à l’espace <span aria-hidden="true">→</span></button>
          <div id="manager-login-message" class="form-message" role="status" aria-live="polite"></div>
        </form>
        <div class="demo-access"><strong>Code de démonstration</strong><code>PROF-2026</code><span>Ce code est public et ne protège pas de vraies données.</span></div>
      </div>
      <p class="manager-login-footnote"><span class="lock-icon" aria-hidden="true">⌑</span> En production, la connexion devra être sécurisée côté serveur.</p>
    </section>
  `
}

function render(): void {
  document.querySelectorAll<HTMLButtonElement>('.mode-button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.mode === mode)
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode))
  })

  pageContent.innerHTML = mode === 'student'
    ? renderStudent()
    : managerAuthenticated
      ? renderManager()
      : renderManagerLogin()

  if (mode === 'student' && !activeCode) {
    const form = document.querySelector<HTMLFormElement>('#login-form')
    const input = document.querySelector<HTMLInputElement>('#student-code')
    const message = document.querySelector<HTMLDivElement>('#login-message')

    form?.addEventListener('submit', (event) => {
      event.preventDefault()
      const code = input?.value.trim().toLocaleUpperCase() ?? ''
      const match = grades.some((grade) => grade.code.toLocaleUpperCase() === code)

      if (!match) {
        if (message) message.textContent = 'Code introuvable. Vérifie-le ou essaie le code de démonstration.'
        return
      }

      activeCode = code
      render()
    })

    document.querySelector<HTMLButtonElement>('#demo-login')?.addEventListener('click', () => {
      activeCode = 'ELEVE-2048'
      render()
    })
  }

  if (mode === 'student' && activeCode) {
    document.querySelector<HTMLButtonElement>('#logout')?.addEventListener('click', () => {
      activeCode = null
      render()
    })
  }

  if (mode === 'manager' && managerAuthenticated) {
    document.querySelector<HTMLInputElement>('#workbook')?.addEventListener('change', (event) => {
      const input = event.currentTarget as HTMLInputElement
      const file = input.files?.[0]
      if (file) void importWorkbook(file)
    })
    document.querySelector<HTMLButtonElement>('#download-template')?.addEventListener('click', downloadTemplate)
    document.querySelector<HTMLButtonElement>('#manager-logout')?.addEventListener('click', () => {
      managerAuthenticated = false
      mode = 'student'
      notice = ''
      render()
    })
  }

  if (mode === 'manager' && !managerAuthenticated) {
    const form = document.querySelector<HTMLFormElement>('#manager-login-form')
    const input = document.querySelector<HTMLInputElement>('#manager-code')
    const message = document.querySelector<HTMLDivElement>('#manager-login-message')

    form?.addEventListener('submit', (event) => {
      event.preventDefault()
      if (input?.value.trim().toLocaleUpperCase() !== 'PROF-2026') {
        if (message) message.textContent = 'Code incorrect. Vérifie le code de démonstration.'
        return
      }

      managerAuthenticated = true
      notice = ''
      render()
    })
  }
}

function normalizeHeader(value: unknown): string {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
}

function readCell(row: unknown[], index: number): unknown {
  return index < 0 ? '' : row[index] ?? ''
}

function parseScore(value: unknown, label: string, rowNumber: number): number {
  const score = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'))
  if (!Number.isFinite(score)) {
    throw new Error(`La valeur « ${label} » est invalide à la ligne ${rowNumber}.`)
  }
  return score
}

function formatDate(value: unknown, rowNumber: number): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Intl.DateTimeFormat('fr-FR').format(value)
  }
  const date = String(value).trim()
  if (!date) throw new Error(`La date est manquante à la ligne ${rowNumber}.`)
  return date
}

function parseWorkbook(buffer: ArrayBuffer): Grade[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) throw new Error('Le classeur ne contient aucune feuille.')

  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], {
    header: 1,
    raw: true,
    defval: '',
  })
  if (rows.length < 2) throw new Error('La feuille ne contient aucune ligne de résultat.')

  const headers = rows[0].map(normalizeHeader)
  const findColumn = (...names: string[]) => headers.findIndex((header) => names.includes(header))
  const columns = {
    code: findColumn('code', 'codeeleve', 'identifiant', 'id'),
    student: findColumn('nom', 'name', 'eleve', 'nomeleve'),
    assessment: findColumn('evaluation', 'epreuve', 'devoir'),
    date: findColumn('date'),
    score: findColumn('note', 'score'),
    maximum: findColumn('sur', 'bareme', 'maximum', 'max'),
  }
  const missing = Object.entries(columns).filter(([, index]) => index < 0).map(([name]) => name)
  if (missing.length) {
    throw new Error('Colonnes manquantes : Code élève, Nom, Évaluation, Date, Note et Sur. Télécharge le modèle pour voir le format attendu.')
  }

  const parsedGrades: Grade[] = []
  const namesByCode = new Map<string, string>()

  for (const [index, row] of rows.slice(1).entries()) {
    const rowNumber = index + 2
    if (row.every((value) => String(value).trim() === '')) continue

    const code = String(readCell(row, columns.code)).trim().toLocaleUpperCase()
    const student = String(readCell(row, columns.student)).trim()
    const assessment = String(readCell(row, columns.assessment)).trim()
    const date = formatDate(readCell(row, columns.date), rowNumber)
    const score = parseScore(readCell(row, columns.score), 'note', rowNumber)
    const maximum = parseScore(readCell(row, columns.maximum), 'barème', rowNumber)

    if (!code || !student || !assessment) {
      throw new Error(`Code élève, nom ou évaluation manquant à la ligne ${rowNumber}.`)
    }
    if (maximum <= 0 || score < 0 || score > maximum) {
      throw new Error(`La note de la ligne ${rowNumber} doit être comprise entre 0 et son barème.`)
    }

    const normalizedName = student.toLocaleLowerCase()
    const existingName = namesByCode.get(code)
    if (existingName && existingName !== normalizedName) {
      throw new Error(`Le code ${code} est associé à plusieurs noms (ligne ${rowNumber}).`)
    }
    namesByCode.set(code, normalizedName)
    parsedGrades.push({ code, student, assessment, date, score, maximum })
    if (parsedGrades.length > 2000) throw new Error('Le fichier dépasse la limite de 2 000 résultats.')
  }

  if (!parsedGrades.length) throw new Error('Aucun résultat valide n’a été trouvé dans le fichier.')
  return parsedGrades
}

async function importWorkbook(file: File): Promise<void> {
  const message = document.querySelector<HTMLDivElement>('#import-message')
  const noticeElement = document.querySelector<HTMLDivElement>('.notice')
  if (file.size > 10 * 1024 * 1024) {
    if (message) message.textContent = 'Le fichier dépasse la limite de 10 Mo.'
    return
  }

  try {
    const importedGrades = parseWorkbook(await file.arrayBuffer())
    grades = importedGrades
    activeCode = null
    notice = `${importedGrades.length} résultat${importedGrades.length > 1 ? 's' : ''} importé${importedGrades.length > 1 ? 's' : ''} avec succès.`
    noticeKind = 'success'
    render()
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Le fichier n’a pas pu être lu.'
    if (message) message.textContent = reason
    if (noticeElement) noticeElement.textContent = reason
  }
}

function downloadTemplate(): void {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Code élève', 'Nom', 'Évaluation', 'Date', 'Note', 'Sur'],
    ['ELEVE-2048', 'Aïcha Martin', 'Contrôle de fractions', '12/11/2026', 16, 20],
  ])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Résultats')
  XLSX.writeFile(workbook, 'modele-notes-de-classe.xlsx')
}

document.querySelectorAll<HTMLButtonElement>('.mode-button').forEach((button) => {
  button.addEventListener('click', () => {
    const nextMode = button.dataset.mode === 'manager' ? 'manager' : 'student'
    if (nextMode === 'student') managerAuthenticated = false
    mode = nextMode
    notice = ''
    render()
  })
})

render()
