// server.js
// Applicazione Express che espone le API REST di ConversAI e serve il front-end statico.

const express = require("express")
const database = require("./database")

const app = express()
const port = 3000

app.use(express.json())
app.use(express.static("public"))

function simulateAssistantResponse(prompt, topic) {
  const trimmedPrompt = prompt.trim()

  // Saluti
  if (/ciao|Ciao|buongiorno|Buongiorno|buonasera|Buonasera|salve|Salve/.test(trimmedPrompt)) {
    return `Ciao! Come posso aiutarti oggi ?`
  }

  // Ringraziamenti
  if (/grazie|Grazie/.test(trimmedPrompt)) {
    return `Di nulla, figurati! Se hai altri dubbi o curiosità su "${topic}", sono sempre a tua disposizione.`
  }

  // Domande
  if (/\?/.test(trimmedPrompt)) {
    return `Ottima domanda! Riguardo a "${topic}", per rispondere in modo completo al tuo dubbio ("${trimmedPrompt}"), ti proporrei un esempio pratico che è sempre utile per capire meglio!.`
  }

  // Riassunti e sintesi
  if (/riassun|Riassun|sintesi|Sintesi|summary|Summary/.test(trimmedPrompt)) {
    return 'Certo, ti faccio subito una sintesi! In breve, per quanto riguarda "${topic}", il cuore del tuo messaggio è "${trimmedPrompt}".`
  }

  // Spiegazioni
  if (/spiega|Spiega|explain|Explain|perch|Perch/.test(trimmedPrompt)) {
    return `Ti spiego volentieri. Nel contesto di "${topic}", la questione che hai sollevato ("${trimmedPrompt}") diventa molto più chiara se partiamo dalle basi per poi guardare la pratica.`
  }

  // Esempi
  if (/esempio|Esempio|example|Example/.test(trimmedPrompt)) {
    return `Un esempio pratico aiuta sempre! Pensando a "${topic}", potremmo immaginare esattamente la situazione che hai descritto: "${trimmedPrompt}".`
  }

  return `Ho letto il tuo messaggio ("${trimmedPrompt}") in merito a "${topic}", dimmi che aspetto in particolare vorresti approfondire!`
}

// Projects

app.get("/api/projects", (req, res) => {
  database.getAllProjects((error, projects) => {
    if (error) {
      console.error(error)
      return res.status(500).json({ error: "Database error" })
    }
    res.status(200).json(projects)
  })
})

app.post("/api/projects", (req, res) => {
  const submittedName = req.body.name

  if (typeof submittedName !== "string" || submittedName.trim().length === 0) {
    return res.status(400).json({ error: "Project name is required" })
  }

  const name = submittedName.trim()
  const description = typeof req.body.description === "string" ? req.body.description.trim() : ""

  database.createProject(name, description, (error, project) => {
    if (error) {
      console.error(error)
      return res.status(500).json({ error: "Database error" })
    }
    res.status(201).location(`/api/projects/${project.id}`).json(project)
  })
})

app.get("/api/projects/:projectId", (req, res) => {
  const projectId = Number(req.params.projectId)

  database.getProjectById(projectId, (error, project) => {
    if (error) {
      console.error(error)
      return res.status(500).json({ error: "Database error" })
    }
    if (!project) {
      return res.status(404).json({ error: "Project not found" })
    }
    res.status(200).json(project)
  })
})

app.patch("/api/projects/:projectId", (req, res) => {
  const projectId = Number(req.params.projectId)
  const submittedName = req.body.name

  if (typeof submittedName !== "string" || submittedName.trim().length === 0) {
    return res.status(400).json({ error: "Project name is required" })
  }

  const name = submittedName.trim()
  const description = typeof req.body.description === "string" ? req.body.description.trim() : ""

  database.updateProject(projectId, { name, description }, (error, project) => {
    if (error) {
      console.error(error)
      return res.status(500).json({ error: "Database error" })
    }
    if (!project) {
      return res.status(404).json({ error: "Project not found" })
    }
    res.status(200).json(project)
  })
})

app.delete("/api/projects/:projectId", (req, res) => {
  const projectId = Number(req.params.projectId)

  database.deleteProject(projectId, (error, wasDeleted) => {
    if (error) {
      console.error(error)
      return res.status(500).json({ error: "Database error" })
    }
    if (!wasDeleted) {
      return res.status(404).json({ error: "Project not found" })
    }
    res.status(204).end()
  })
})

// Conversations

app.get("/api/projects/:projectId/conversations", (req, res) => {
  const projectId = Number(req.params.projectId)

  const filters = {
    favoritesOnly: req.query.favorite === "true",
    includeArchived: req.query.includeArchived === "true",
    archivedOnly: req.query.archivedOnly === "true"
  }

  database.getProjectById(projectId, (error, project) => {
    if (error) {
      console.error(error)
      return res.status(500).json({ error: "Database error" })
    }
    if (!project) {
      return res.status(404).json({ error: "Project not found" })
    }

    database.getConversationsByProject(projectId, filters, (convError, conversations) => {
      if (convError) {
        console.error(convError)
        return res.status(500).json({ error: "Database error" })
      }
      res.status(200).json(conversations)
    })
  })
})

app.post("/api/projects/:projectId/conversations", (req, res) => {
  const projectId = Number(req.params.projectId)
  const submittedTopic = req.body.topic

  if (typeof submittedTopic !== "string" || submittedTopic.trim().length === 0) {
    return res.status(400).json({ error: "Conversation topic is required" })
  }

  const topic = submittedTopic.trim()

  database.getProjectById(projectId, (error, project) => {
    if (error) {
      console.error(error)
      return res.status(500).json({ error: "Database error" })
    }
    if (!project) {
      return res.status(404).json({ error: "Project not found" })
    }

    database.createConversation(projectId, topic, (createError, conversation) => {
      if (createError) {
        console.error(createError)
        return res.status(500).json({ error: "Database error" })
      }
      res.status(201).location(`/api/conversations/${conversation.id}`).json(conversation)
    })
  })
})

app.get("/api/conversations/:conversationId", (req, res) => {
  const conversationId = Number(req.params.conversationId)

  database.getConversationById(conversationId, (error, conversation) => {
    if (error) {
      console.error(error)
      return res.status(500).json({ error: "Database error" })
    }
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" })
    }
    res.status(200).json(conversation)
  })
})

app.patch("/api/conversations/:conversationId", (req, res) => {
  const conversationId = Number(req.params.conversationId)
  const fields = {}

  if (req.body.topic !== undefined) {
    if (typeof req.body.topic !== "string" || req.body.topic.trim().length === 0) {
      return res.status(400).json({ error: "Topic must be a non-empty string" })
    }
    fields.topic = req.body.topic.trim()
  }

  if (req.body.isFavorite !== undefined) {
    fields.isFavorite = Boolean(req.body.isFavorite)
  }

  if (req.body.isArchived !== undefined) {
    fields.isArchived = Boolean(req.body.isArchived)
  }

  database.updateConversation(conversationId, fields, (error, conversation) => {
    if (error) {
      console.error(error)
      return res.status(500).json({ error: "Database error" })
    }
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" })
    }
    res.status(200).json(conversation)
  })
})

app.delete("/api/conversations/:conversationId", (req, res) => {
  const conversationId = Number(req.params.conversationId)

  database.deleteConversation(conversationId, (error, wasDeleted) => {
    if (error) {
      console.error(error)
      return res.status(500).json({ error: "Database error" })
    }
    if (!wasDeleted) {
      return res.status(404).json({ error: "Conversation not found" })
    }
    res.status(204).end()
  })
})

// Messages

app.get("/api/conversations/:conversationId/messages", (req, res) => {
  const conversationId = Number(req.params.conversationId)

  database.getConversationById(conversationId, (error, conversation) => {
    if (error) {
      console.error(error)
      return res.status(500).json({ error: "Database error" })
    }
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" })
    }

    database.getMessagesByConversation(conversationId, (msgError, messages) => {
      if (msgError) {
        console.error(msgError)
        return res.status(500).json({ error: "Database error" })
      }
      res.status(200).json(messages)
    })
  })
})

app.post("/api/conversations/:conversationId/messages", (req, res) => {
  const conversationId = Number(req.params.conversationId)
  const submittedContent = req.body.content

  if (typeof submittedContent !== "string" || submittedContent.trim().length === 0) {
    return res.status(400).json({ error: "Message content is required" })
  }

  const content = submittedContent.trim()

  database.getConversationById(conversationId, (error, conversation) => {
    if (error) {
      console.error(error)
      return res.status(500).json({ error: "Database error" })
    }
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" })
    }

    //Salvo il messaggio dell'utente
    database.createMessage(conversationId, "user", content, (userError, userMessage) => {
      if (userError) {
        console.error(userError)
        return res.status(500).json({ error: "Database error" })
      }

      // 2)Genero e salvo la risposta simulata dell'assistente
      const assistantContent = simulateAssistantResponse(content, conversation.topic)

      database.createMessage(conversationId, "assistant", assistantContent, (assistantError, assistantMessage) => {
        if (assistantError) {
          console.error(assistantError)
          return res.status(500).json({ error: "Database error" })
        }

        // 3) Aggiorno il timestamp della conversazione e rispondo con entrambi i messaggi
        database.touchConversation(conversationId, () => {
          res.status(201).json({
            userMessage,
            assistantMessage
          })
        })
      })
    })
  })
})


app.get("/api/search", (req, res) => {
  const query = req.query.q

  if (typeof query !== "string" || query.trim().length === 0) {
    return res.status(400).json({ error: "Query parameter q is required" })
  }

  database.searchEverything(query.trim(), (error, results) => {
    if (error) {
      console.error(error)
      return res.status(500).json({ error: "Database error" })
    }
    res.status(200).json(results)
  })
})

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Resource not found" })
})

app.listen(port, () => {
  console.log(`ConversAI server listening at http://localhost:${port}`)
})
