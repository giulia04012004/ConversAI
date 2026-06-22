// database.js
// Gestisce la connessione a SQLite e tutte le operazioni di accesso ai dati.
// Le route in server.js non contengono SQL: usano solo le funzioni esportate da qui.

const sqlite3 = require("sqlite3").verbose()
const database = new sqlite3.Database("data/app.sqlite")

// ---------------------------------------------------------------------------
// Creazione delle tabelle (se non esistono già)
// ---------------------------------------------------------------------------

database.run(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`)

database.run(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    topic TEXT NOT NULL,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`)

database.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    conversation_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`)

// ---------------------------------------------------------------------------
// Funzioni di mappatura: riga del database -> oggetto usato dalle API
// ---------------------------------------------------------------------------

function mapProject(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapConversation(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    topic: row.topic,
    isFavorite: Boolean(row.is_favorite),
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at
  }
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

function getAllProjects(callback) {
  database.all(
    "SELECT id, name, description, created_at, updated_at FROM projects ORDER BY created_at DESC",
    (error, rows) => {
      if (error) {
        return callback(error)
      }
      callback(null, rows.map(mapProject))
    }
  )
}

function getProjectById(projectId, callback) {
  database.get(
    "SELECT id, name, description, created_at, updated_at FROM projects WHERE id = ?",
    [projectId],
    (error, row) => {
      if (error) {
        return callback(error)
      }
      callback(null, row ? mapProject(row) : null)
    }
  )
}

function createProject(name, description, callback) {
  const now = new Date().toISOString()
  database.run(
    "INSERT INTO projects (name, description, created_at, updated_at) VALUES (?, ?, ?, ?)",
    [name, description, now, now],
    function (error) {
      if (error) {
        return callback(error)
      }
      callback(null, {
        id: this.lastID,
        name,
        description,
        createdAt: now,
        updatedAt: now
      })
    }
  )
}

// new Date() crea un oggetto che rappresenta l'istante corrente (data e ora
// del momento in cui il codice viene eseguito). .toISOString() lo converte
// in una stringa di testo in formato standard ISO 8601, ad esempio
// "2026-06-21T14:32:08.123Z" - anno-mese-giorno, poi T, poi ora:minuti:secondi
// in UTC (fuso orario universale), chiusa da Z.

// Per sapere se il progetto esiste prima di aggiornarlo/eliminarlo uso
// sempre getProjectById come controllo preliminare (stesso pattern di
// ricerca con .get() visto a Lezione 24), invece di leggere this.changes
// dopo la query: this.changes non è mai citato nei PDF, solo this.lastID lo è.

function updateProject(projectId, fields, callback) {
  const now = new Date().toISOString()

  getProjectById(projectId, (error, existingProject) => {
    if (error) {
      return callback(error)
    }
    if (!existingProject) {
      return callback(null, null)
    }

    database.run(
      "UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?",
      [fields.name, fields.description, now, projectId],
      updateError => {
        if (updateError) {
          return callback(updateError)
        }
        getProjectById(projectId, callback)
      }
    )
  })
}

// Elimina tutti i messaggi di una conversazione (passo preliminare prima
// di eliminare la conversazione stessa).
function deleteMessagesByConversation(conversationId, callback) {
  database.run(
    "DELETE FROM messages WHERE conversation_id = ?",
    [conversationId],
    error => {
      callback(error || null)
    }
  )
}

// Elimina i messaggi di ogni conversazione passata in conversationList, poi
// elimina tutte quelle conversazioni con un'unica DELETE sul progetto.
// Uso un ciclo for...of (Lezione 19, sez. 4 e 6, stessa sintassi già usata
// in searchEverything più sotto) invece della ricorsione: dato che le
// conversazioni sono indipendenti tra loro, l'ordine in cui i loro messaggi
// vengono eliminati non conta - l'unico ordine che conta davvero è "prima
// tutti i messaggi, poi le conversazioni, poi il progetto", che qui resta
// rispettato.
function deleteConversationsAndMessages(projectId, conversationList, callback) {
  let pendingDeletions = conversationList.length
  let hasFailed = false

  if (pendingDeletions === 0) {
    return deleteAllProjectConversations(projectId, callback)
  }

  for (const conversation of conversationList) {
    deleteMessagesByConversation(conversation.id, error => {
      if (hasFailed) {
        return
      }
      if (error) {
        hasFailed = true
        return callback(error)
      }

      pendingDeletions -= 1
      if (pendingDeletions === 0) {
        deleteAllProjectConversations(projectId, callback)
      }
    })
  }
}

// Elimina in un solo colpo tutte le conversazioni di un progetto (i loro
// messaggi sono già stati rimossi da deleteConversationsAndMessages).
function deleteAllProjectConversations(projectId, callback) {
  database.run(
    "DELETE FROM conversations WHERE project_id = ?",
    [projectId],
    error => {
      callback(error || null)
    }
  )
}

function deleteProject(projectId, callback) {
  getProjectById(projectId, (error, existingProject) => {
    if (error) {
      return callback(error)
    }
    if (!existingProject) {
      return callback(null, false)
    }

    // Prima recupero tutte le conversazioni del progetto (comprese quelle
    // archiviate), poi elimino in cascata conversazioni e messaggi, e solo
    // alla fine il progetto stesso.
    getConversationsByProject(projectId, { favoritesOnly: false, includeArchived: true }, (conversationsError, projectConversations) => {
      if (conversationsError) {
        return callback(conversationsError)
      }

      deleteConversationsAndMessages(projectId, projectConversations, cascadeError => {
        if (cascadeError) {
          return callback(cascadeError)
        }

        database.run(
          "DELETE FROM projects WHERE id = ?",
          [projectId],
          deleteError => {
            if (deleteError) {
              return callback(deleteError)
            }
            callback(null, true)
          }
        )
      })
    })
  })
}
// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

function getConversationsByProject(projectId, filters, callback) {
  let sql = `
    SELECT id, project_id, topic, is_favorite, is_archived, created_at, updated_at
    FROM conversations
    WHERE project_id = ?
  `
  const params = [projectId]

  if (filters.favoritesOnly) {
    sql += " AND is_favorite = 1"
  }

  if (filters.archivedOnly) {
    sql += " AND is_archived = 1"
  } else if (!filters.includeArchived) {
    sql += " AND is_archived = 0"
  }

  sql += " ORDER BY updated_at DESC"

  database.all(sql, params, (error, rows) => {
    if (error) {
      return callback(error)
    }
    callback(null, rows.map(mapConversation))
  })
}

function getConversationById(conversationId, callback) {
  database.get(
    "SELECT id, project_id, topic, is_favorite, is_archived, created_at, updated_at FROM conversations WHERE id = ?",
    [conversationId],
    (error, row) => {
      if (error) {
        return callback(error)
      }
      callback(null, row ? mapConversation(row) : null)
    }
  )
}

function createConversation(projectId, topic, callback) {
  const now = new Date().toISOString()
  database.run(
    "INSERT INTO conversations (project_id, topic, is_favorite, is_archived, created_at, updated_at) VALUES (?, ?, 0, 0, ?, ?)",
    [projectId, topic, now, now],
    function (error) {
      if (error) {
        return callback(error)
      }
      callback(null, {
        id: this.lastID,
        projectId,
        topic,
        isFavorite: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now
      })
    }
  )
}

function updateConversation(conversationId, fields, callback) {
  const now = new Date().toISOString()

  getConversationById(conversationId, (error, existing) => {
    if (error) {
      return callback(error)
    }
    if (!existing) {
      return callback(null, null)
    }

    const topic = fields.topic !== undefined ? fields.topic : existing.topic
    const isFavorite = fields.isFavorite !== undefined ? fields.isFavorite : existing.isFavorite
    const isArchived = fields.isArchived !== undefined ? fields.isArchived : existing.isArchived

    database.run(
      "UPDATE conversations SET topic = ?, is_favorite = ?, is_archived = ?, updated_at = ? WHERE id = ?",
      [topic, isFavorite ? 1 : 0, isArchived ? 1 : 0, now, conversationId],
      updateError => {
        if (updateError) {
          return callback(updateError)
        }
        getConversationById(conversationId, callback)
      }
    )
  })
}

function deleteConversation(conversationId, callback) {
  getConversationById(conversationId, (error, existingConversation) => {
    if (error) {
      return callback(error)
    }
    if (!existingConversation) {
      return callback(null, false)
    }

    // Prima elimino i messaggi della conversazione (stessa funzione già
    // usata da deleteProject), poi la conversazione stessa - altrimenti i
    // messaggi resterebbero orfani nella tabella messages.
    deleteMessagesByConversation(conversationId, messagesError => {
      if (messagesError) {
        return callback(messagesError)
      }

      database.run(
        "DELETE FROM conversations WHERE id = ?",
        [conversationId],
        deleteError => {
          if (deleteError) {
            return callback(deleteError)
          }
          callback(null, true)
        }
      )
    })
  })
}

// Versione senza filtri, usata solo dalla ricerca (sez. successiva): legge
// tutte le conversazioni di tutti i progetti con una singola SELECT di base.
function getAllConversationsRaw(callback) {
  database.all(
    "SELECT id, project_id, topic, is_favorite, is_archived, created_at, updated_at FROM conversations",
    (error, rows) => {
      if (error) {
        return callback(error)
      }
      callback(null, rows.map(mapConversation))
    }
  )
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

function getMessagesByConversation(conversationId, callback) {
  database.all(
    "SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC",
    [conversationId],
    (error, rows) => {
      if (error) {
        return callback(error)
      }
      callback(null, rows.map(mapMessage))
    }
  )
}

function createMessage(conversationId, role, content, callback) {
  const now = new Date().toISOString()
  database.run(
    "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)",
    [conversationId, role, content, now],
    function (error) {
      if (error) {
        return callback(error)
      }
      callback(null, {
        id: this.lastID,
        conversationId,
        role,
        content,
        createdAt: now
      })
    }
  )
}

function touchConversation(conversationId, callback) {
  const now = new Date().toISOString()
  database.run(
    "UPDATE conversations SET updated_at = ? WHERE id = ?",
    [now, conversationId],
    error => {
      callback(error || null)
    }
  )
}

// Versione senza filtri, usata solo dalla ricerca: legge tutti i messaggi
// di tutte le conversazioni con una singola SELECT di base.
function getAllMessagesRaw(callback) {
  database.all(
    "SELECT id, conversation_id, role, content, created_at FROM messages",
    (error, rows) => {
      if (error) {
        return callback(error)
      }
      callback(null, rows.map(mapMessage))
    }
  )
}

// ---------------------------------------------------------------------------
// Search (funzionalità extra 4.5 - ricerca nello storico)
//
// I tuoi PDF mostrano solo SELECT/INSERT/UPDATE/DELETE su una singola
// tabella (Lezione 24): niente JOIN, niente LIKE. Per restare dentro questi
// limiti, la ricerca funziona così:
//   1) si leggono TUTTE le righe delle tre tabelle con tre SELECT separate
//      (nessun JOIN: il collegamento fra le tabelle si fa "a mano" in
//      JavaScript con find(), come tasks.find() nella Lezione 23)
//   2) il confronto testuale è case-sensitive e fatto con un ciclo manuale
//      carattere per carattere (funzione containsSubstring più sotto),
//      usando solo .length e l'accesso per indice testo[i] - la stessa
//      sintassi di array[indice] vista nella Lezione 19, qui applicata a
//      una stringa invece che a un array.
// ---------------------------------------------------------------------------

function containsSubstring(text, query) {
  if (query.length === 0) {
    return true
  }

  for (let startIndex = 0; startIndex <= text.length - query.length; startIndex += 1) {
    let isMatch = true

    for (let offset = 0; offset < query.length; offset += 1) {
      if (text[startIndex + offset] !== query[offset]) {
        isMatch = false
      }
    }

    if (isMatch) {
      return true
    }
  }

  return false
}

function searchEverything(query, callback) {
  getAllProjects((projectError, allProjects) => {
    if (projectError) {
      return callback(projectError)
    }

    getAllConversationsRaw((conversationError, allConversations) => {
      if (conversationError) {
        return callback(conversationError)
      }

      getAllMessagesRaw((messageError, allMessages) => {
        if (messageError) {
          return callback(messageError)
        }

        const matchingProjects = []
        const matchingConversations = []
        const matchingMessages = []

        for (const project of allProjects) {
          const descr = project.description || ""
          if (containsSubstring(project.name, query) || containsSubstring(descr, query)) {
            matchingProjects.push({
              projectId: project.id,
              projectName: project.name,
              projectDescription: project.description
            })
          }
        }

        for (const conversation of allConversations) {
          if (containsSubstring(conversation.topic, query)) {
            const project = allProjects.find(item => item.id === conversation.projectId)
            if (project) {
              matchingConversations.push({
                conversationId: conversation.id,
                conversationTopic: conversation.topic,
                projectId: project.id,
                projectName: project.name
              })
            }
          }
        }

        for (const message of allMessages) {
          if (containsSubstring(message.content, query)) {
            const conversation = allConversations.find(item => item.id === message.conversationId)
            if (conversation) {
              const project = allProjects.find(item => item.id === conversation.projectId)
              if (project) {
                matchingMessages.push({
                  messageId: message.id,
                  messageContent: message.content,
                  messageRole: message.role,
                  conversationId: conversation.id,
                  conversationTopic: conversation.topic,
                  projectId: project.id,
                  projectName: project.name
                })
              }
            }
          }
        }

        callback(null, {
          projects: matchingProjects,
          conversations: matchingConversations,
          messages: matchingMessages
        })
      })
    })
  })
}

module.exports = {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getConversationsByProject,
  getConversationById,
  createConversation,
  updateConversation,
  deleteConversation,
  getMessagesByConversation,
  createMessage,
  touchConversation,
  searchEverything
}
