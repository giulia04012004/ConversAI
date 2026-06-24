// client.js
// Logica front-end di ConversAI: comunica con le API REST tramite fetch
// e aggiorna il DOM senza ricaricare la pagina.

const projectForm = document.querySelector(".project-form")
const projectNameInput = document.querySelector(".project-name-input")
const projectDescriptionInput = document.querySelector(".project-description-input")
const projectFormStatus = document.querySelector(".project-form-status")
const projectList = document.querySelector(".project-list")
const newProjectButton = document.querySelector(".new-project-button")

const searchForm = document.querySelector(".search-form")
const searchInput = document.querySelector(".search-input")
const searchStatus = document.querySelector(".search-status")
const searchResults = document.querySelector(".search-results")

// Tre stati dell'area principale
const noConversationMessage = document.querySelector(".no-conversation-message")
const projectView = document.querySelector(".project-view")
const projectViewTitle = document.querySelector(".project-view-title")
const newConversationButton = document.querySelector(".new-conversation-button")
const conversationForm = document.querySelector(".conversation-form")
const conversationTopicInput = document.querySelector(".conversation-topic-input")
const conversationFormStatus = document.querySelector(".conversation-form-status")
const conversationFilters = document.querySelector(".conversation-filters")
const filterPillAll = document.querySelector(".filter-pill-all")
const filterPillFavorites = document.querySelector(".filter-pill-favorites")
const filterPillArchived = document.querySelector(".filter-pill-archived")
const conversationList = document.querySelector(".conversation-list")

const conversationView = document.querySelector(".conversation-view")
const backToProjectButton = document.querySelector(".back-to-project-button")
const conversationTopicHeading = document.querySelector(".conversation-topic")
const toggleFavoriteButton = document.querySelector(".toggle-favorite-button")
const toggleArchiveButton = document.querySelector(".toggle-archive-button")
const deleteConversationButton = document.querySelector(".delete-conversation-button")
const messageList = document.querySelector(".message-list")
const messageForm = document.querySelector(".message-form")
const messageInput = document.querySelector(".message-input")
const messageFormStatus = document.querySelector(".message-form-status")
const messageSubmitButton = messageForm.querySelector("button[type='submit']")

const sidebar = document.querySelector(".sidebar")
const sidebarToggleButton = document.querySelector(".sidebar-toggle-button")

// Stato applicativo

let projects = []
let conversations = []
let currentProject = null
let currentConversation = null

//"clicca due volte per confermare" 
let pendingDeleteConversationId = null
let pendingDeleteProjectId = null

// Filtro attivo sulla lista conversazioni: "all", "favorites", "archived"
let activeFilter = "all"

// Funzioni di supporto

function readJsonOrThrow(response) {
  if (response.status === 204) {
    return null
  }
  return response.json().then(data => {
    if (!response.ok) {
      throw new Error(data.error || "Request failed")
    }
    return data
  })
}

function showStatus(element, message, isError) {
  element.textContent = message
  element.classList.toggle("is-error", Boolean(isError))

  if (!isError) {
    setTimeout(function() {
      if (element.textContent === message) {
        clearStatus(element)
      }
    }, 3000)
  }
}

function clearStatus(element) {
  element.textContent = ""
  element.classList.remove("is-error")
}


function encodeQueryValue(value) {
  let encoded = ""

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]

    if (character === "%") {
      encoded += "%25"
    } else if (character === " ") {
      encoded += "%20"
    } else if (character === "&") {
      encoded += "%26"
    } else if (character === "#") {
      encoded += "%23"
    } else if (character === "?") {
      encoded += "%3F"
    } else if (character === "=") {
      encoded += "%3D"
    } else if (character === "+") {
      encoded += "%2B"
    } else {
      encoded += character
    }
  }

  return encoded
}

// Mostra lo stato "nessun progetto": area di benvenuto
function showWelcomeState() {
  noConversationMessage.hidden = false
  projectView.hidden = true
  conversationView.hidden = true
  messageList.replaceChildren()
}

// Mostra lo stato "progetto aperto": lista conversazioni
function showProjectState() {
  noConversationMessage.hidden = true
  projectView.hidden = false
  conversationView.hidden = true
  messageList.replaceChildren()
}

// Mostra lo stato "conversazione aperta": chat
function showConversationState() {
  noConversationMessage.hidden = true
  projectView.hidden = true
  conversationView.hidden = false
}


// Projects
function loadProjects() {
  fetch("/api/projects")
    .then(readJsonOrThrow)
    .then(showProjects)
    .catch(error => showStatus(projectFormStatus, error.message, true))
}

function showProjects(loadedProjects) {
  projects = loadedProjects
  renderProjects()
}

function renderProjects() {
  projectList.replaceChildren()

  for (const project of projects) {
    const item = document.createElement("li")
    item.classList.add("project-item")
    item.classList.toggle("is-selected", Boolean(currentProject) && currentProject.id === project.id)

    const button = document.createElement("button")
    button.classList.add("project-button")
    button.textContent = project.name
    button.addEventListener("click", () => selectProject(project))

    const deleteButton = document.createElement("button")
    deleteButton.classList.add("project-delete-button")
    deleteButton.classList.toggle("is-pending", pendingDeleteProjectId === project.id)
    deleteButton.textContent = pendingDeleteProjectId === project.id ? "Confermi?" : "Elimina"
    deleteButton.addEventListener("click", () => handleDeleteProject(project))

    item.append(button, deleteButton)
    projectList.append(item)
  }
}

function handleDeleteProject(project) {
  if (pendingDeleteProjectId !== project.id) {
    pendingDeleteProjectId = project.id
    renderProjects()
    return
  }

  pendingDeleteProjectId = null

  fetch(`/api/projects/${project.id}`, { method: "DELETE" })
    .then(readJsonOrThrow)
    .then(() => {
      projects = projects.filter(item => item.id !== project.id)

      if (currentProject && currentProject.id === project.id) {
        currentProject = null
        currentConversation = null
        conversations = []
        conversationList.replaceChildren()
        conversationForm.hidden = true
        conversationFilters.hidden = true
        showWelcomeState()
      }

      renderProjects()
      searchResults.replaceChildren()
      clearStatus(searchStatus)
      showStatus(projectFormStatus, "Progetto eliminato.", false)
    })
    .catch(error => showStatus(projectFormStatus, error.message, true))
}

function handleProjectSubmit(event) {
  event.preventDefault()
  clearStatus(projectFormStatus)

  const name = projectNameInput.value.trim()
  const description = projectDescriptionInput.value.trim()

  if (!name) {
    showStatus(projectFormStatus, "Inserisci un nome per il progetto.", true)
    return
  }

  fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description })
  })
    .then(readJsonOrThrow)
    .then(project => {
      projects.push(project)
      renderProjects()
      projectNameInput.value = ""
      projectDescriptionInput.value = ""
      projectForm.hidden = true
      showStatus(projectFormStatus, "Progetto creato.", false)
      selectProject(project)
    })
    .catch(error => showStatus(projectFormStatus, error.message, true))
}

function handleNewProjectToggle() {
  projectForm.hidden = !projectForm.hidden
  clearStatus(projectFormStatus)
}

function selectProject(project) {
  currentProject = project
  currentConversation = null
  pendingDeleteProjectId = null

  renderProjects()

  projectViewTitle.textContent = project.name
  conversationForm.hidden = true
  conversationFilters.hidden = false

  // Resetta i pill al cambio di progetto
  activeFilter = "all"
  filterPillAll.classList.add("is-active")
  filterPillFavorites.classList.remove("is-active")
  filterPillArchived.classList.remove("is-active")

  showProjectState()
  loadConversations()
}

// Conversations

function loadConversations() {
  if (!currentProject) {
    return
  }

  let queryString = ""

  if (activeFilter === "favorites") {
    queryString = "favorite=true"
  } else if (activeFilter === "archived") {
    queryString = "archivedOnly=true"
  }

  let url = `/api/projects/${currentProject.id}/conversations`
  if (queryString.length > 0) {
    url = `${url}?${queryString}`
  }

  fetch(url)
    .then(readJsonOrThrow)
    .then(showConversations)
    .catch(error => showStatus(conversationFormStatus, error.message, true))
}

function showConversations(loadedConversations) {
  conversations = loadedConversations
  renderConversations()
}

function renderConversations() {
  conversationList.replaceChildren()

  for (const conversation of conversations) {
    const item = document.createElement("li")
    item.classList.add("conversation-item")
    item.classList.toggle(
      "is-selected",
      Boolean(currentConversation) && currentConversation.id === conversation.id
    )
    item.classList.toggle("is-archived", conversation.isArchived)

    const button = document.createElement("button")
    button.classList.add("conversation-button")
    button.textContent = conversation.isFavorite ? `★ ${conversation.topic}` : conversation.topic
    button.addEventListener("click", () => selectConversation(conversation))

    item.append(button)
    conversationList.append(item)
  }
}

function handleNewConversationToggle() {
  conversationForm.hidden = !conversationForm.hidden
  clearStatus(conversationFormStatus)
}

function handleConversationSubmit(event) {
  event.preventDefault()
  clearStatus(conversationFormStatus)

  if (!currentProject) {
    return
  }

  const topic = conversationTopicInput.value.trim()

  if (!topic) {
    showStatus(conversationFormStatus, "Inserisci un topic per la conversazione.", true)
    return
  }

  fetch(`/api/projects/${currentProject.id}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic })
  })
    .then(readJsonOrThrow)
    .then(conversation => {
      conversations.push(conversation)
      renderConversations()
      conversationTopicInput.value = ""
      conversationForm.hidden = true
      showStatus(conversationFormStatus, "Conversazione creata.", false)
      selectConversation(conversation)
    })
    .catch(error => showStatus(conversationFormStatus, error.message, true))
}

function setActiveFilter(filter) {
  activeFilter = filter
  filterPillAll.classList.toggle("is-active", filter === "all")
  filterPillFavorites.classList.toggle("is-active", filter === "favorites")
  filterPillArchived.classList.toggle("is-active", filter === "archived")
  loadConversations()
}

function selectConversation(conversation) {
  currentConversation = conversation
  renderConversations()

  pendingDeleteConversationId = null
  deleteConversationButton.textContent = "Elimina"
  deleteConversationButton.classList.remove("is-pending")

  conversationTopicHeading.textContent = conversation.topic
  updateConversationActionLabels()

  showConversationState()
  loadMessages()
}

function updateConversationActionLabels() {
  toggleFavoriteButton.textContent = currentConversation.isFavorite
    ? "★ Rimuovi dai preferiti"
    : "☆ Aggiungi ai preferiti"
  toggleFavoriteButton.classList.toggle("is-active", currentConversation.isFavorite)

  toggleArchiveButton.textContent = currentConversation.isArchived
    ? "Ripristina"
    : "Archivia"
}

function handleToggleFavorite() {
  if (!currentConversation) return
  updateConversation({ isFavorite: !currentConversation.isFavorite })
}

function handleToggleArchive() {
  if (!currentConversation) return
  updateConversation({ isArchived: !currentConversation.isArchived })
}

function updateConversation(fields) {
  fetch(`/api/conversations/${currentConversation.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields)
  })
    .then(readJsonOrThrow)
    .then(updatedConversation => {
      currentConversation = updatedConversation
      updateConversationActionLabels()

      const index = conversations.findIndex(item => item.id === updatedConversation.id)
      if (index !== -1) {
        conversations[index] = updatedConversation
      }

      loadConversations()
    })
    .catch(error => showStatus(messageFormStatus, error.message, true))
}

function handleDeleteConversation() {
  if (!currentConversation) return

  if (pendingDeleteConversationId !== currentConversation.id) {
    pendingDeleteConversationId = currentConversation.id
    deleteConversationButton.textContent = "Sicuro? Clicca di nuovo"
    deleteConversationButton.classList.add("is-pending")
    return
  }

  pendingDeleteConversationId = null
  deleteConversationButton.textContent = "Elimina"
  deleteConversationButton.classList.remove("is-pending")

  fetch(`/api/conversations/${currentConversation.id}`, { method: "DELETE" })
    .then(readJsonOrThrow)
    .then(() => {
      currentConversation = null
      showProjectState()
      loadConversations()
    })
    .catch(error => showStatus(messageFormStatus, error.message, true))
}

// Messages

function loadMessages() {
  if (!currentConversation) return

  fetch(`/api/conversations/${currentConversation.id}/messages`)
    .then(readJsonOrThrow)
    .then(renderMessages)
    .catch(error => showStatus(messageFormStatus, error.message, true))
}

function renderMessages(messages) {
  messageList.replaceChildren()
  for (const message of messages) {
    messageList.append(createMessageElement(message))
  }
}

function createMessageElement(message) {
  const item = document.createElement("li")
  item.classList.add("message-item")
  item.classList.add(`message-role-${message.role}`)

  const roleLabel = document.createElement("span")
  roleLabel.classList.add("message-role-label")
  roleLabel.textContent = message.role === "user" ? "Tu" : "ConversAI"

  const content = document.createElement("p")
  content.classList.add("message-content")
  content.textContent = message.content

  item.append(roleLabel, content)
  return item
}

function handleMessageSubmit(event) {
  event.preventDefault()
  clearStatus(messageFormStatus)

  if (!currentConversation) return

  const content = messageInput.value.trim()

  if (!content) {
    showStatus(messageFormStatus, "Scrivi un messaggio prima di inviarlo.", true)
    return
  }

  messageSubmitButton.disabled = true
  showStatus(messageFormStatus, "Invio in corso...", false)

  fetch(`/api/conversations/${currentConversation.id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content })
  })
    .then(readJsonOrThrow)
    .then(data => {
      messageList.append(createMessageElement(data.userMessage))
      messageList.append(createMessageElement(data.assistantMessage))
      messageInput.value = ""
      clearStatus(messageFormStatus)
    })
    .catch(error => showStatus(messageFormStatus, error.message, true))
    .then(() => {
      messageSubmitButton.disabled = false
    })
}

// Ricerca

function handleSearchSubmit(event) {
  event.preventDefault()
  clearStatus(searchStatus)

  const query = searchInput.value.trim()

  if (!query) {
    showStatus(searchStatus, "Inserisci un termine di ricerca.", true)
    return
  }

  fetch(`/api/search?q=${encodeQueryValue(query)}`)
    .then(readJsonOrThrow)
    .then(results => {
      searchInput.value = ""
      renderSearchResults(results)
    })
    .catch(error => showStatus(searchStatus, error.message, true))
}

function renderSearchResults(results) {
  searchResults.replaceChildren()

  const total = results.projects.length + results.conversations.length + results.messages.length

  if (total === 0) {
    showStatus(searchStatus, "Nessun risultato trovato.", false)
    return
  }

  clearStatus(searchStatus)

  for (const result of results.projects) {
    const item = document.createElement("li")
    item.classList.add("search-result-item")

    const label = document.createElement("span")
    label.classList.add("search-result-type-label")
    label.textContent = "Progetto"

    const button = document.createElement("button")
    button.classList.add("search-result-button")
    button.textContent = result.projectName

    button.addEventListener("click", () => openSearchResultProject(result))
    item.append(label, button)
    searchResults.append(item)
  }

  for (const result of results.conversations) {
    const item = document.createElement("li")
    item.classList.add("search-result-item")

    const label = document.createElement("span")
    label.classList.add("search-result-type-label")
    label.textContent = "Conversazione"

    const button = document.createElement("button")
    button.classList.add("search-result-button")
    button.textContent = `${result.projectName} › ${result.conversationTopic}`

    button.addEventListener("click", () => openSearchResultConversation(result))
    item.append(label, button)
    searchResults.append(item)
  }

  for (const result of results.messages) {
    const item = document.createElement("li")
    item.classList.add("search-result-item")

    const label = document.createElement("span")
    label.classList.add("search-result-type-label")
    label.textContent = "Messaggio"

    const button = document.createElement("button")
    button.classList.add("search-result-button")
    button.textContent = `${result.projectName} › ${result.conversationTopic}`

    const preview = document.createElement("p")
    preview.classList.add("search-result-preview")
    preview.textContent = result.messageContent

    button.addEventListener("click", () => openSearchResultConversation(result))
    item.append(label, button, preview)
    searchResults.append(item)
  }
}

function openSearchResultProject(result) {
  fetch(`/api/projects/${result.projectId}`)
    .then(readJsonOrThrow)
    .then(project => selectProject(project))
    .catch(error => showStatus(searchStatus, error.message, true))
}

function openSearchResultConversation(result) {
  fetch(`/api/projects/${result.projectId}`)
    .then(readJsonOrThrow)
    .then(project => {
      selectProject(project)
      return fetch(`/api/conversations/${result.conversationId}`)
    })
    .then(readJsonOrThrow)
    .then(conversation => selectConversation(conversation))
    .catch(error => showStatus(searchStatus, error.message, true))
}

// Sidebar apri/chiudi

function handleSidebarToggle() {
  sidebar.classList.toggle("is-collapsed")
  const isCollapsed = sidebar.classList.contains("is-collapsed")
  sidebarToggleButton.textContent = isCollapsed ? "›" : "‹"
}

// Collegamento degli event listener

projectForm.addEventListener("submit", handleProjectSubmit)
newProjectButton.addEventListener("click", handleNewProjectToggle)
newConversationButton.addEventListener("click", handleNewConversationToggle)
conversationForm.addEventListener("submit", handleConversationSubmit)
filterPillAll.addEventListener("click", function() { setActiveFilter("all") })
filterPillFavorites.addEventListener("click", function() { setActiveFilter("favorites") })
filterPillArchived.addEventListener("click", function() { setActiveFilter("archived") })
toggleFavoriteButton.addEventListener("click", handleToggleFavorite)
toggleArchiveButton.addEventListener("click", handleToggleArchive)
deleteConversationButton.addEventListener("click", handleDeleteConversation)
messageForm.addEventListener("submit", handleMessageSubmit)
messageInput.addEventListener("keydown", function(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault()
    handleMessageSubmit(event)
  }
})
backToProjectButton.addEventListener("click", function() { showProjectState() })
searchForm.addEventListener("submit", handleSearchSubmit)
sidebarToggleButton.addEventListener("click", handleSidebarToggle)

// Inizializzazione

loadProjects()
