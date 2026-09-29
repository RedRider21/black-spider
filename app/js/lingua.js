/* Black Spider — le lingue.
 *
 * Un dizionario solo, due colonne. Le chiavi sono le stesse per tutte le lingue,
 * e una chiave che manca in una lingua cade su quella predefinita invece di
 * lasciare un buco: una frase in italiano è un difetto piccolo, una frase vuota
 * è un difetto che non si capisce.
 *
 * La lingua non è solo testo: cambia anche `document.documentElement.lang`, che
 * serve ai lettori di schermo e alla sillabazione del browser.
 */

export const LINGUE = [
  { codice: 'it', nome: 'Italiano', breve: 'IT' },
  { codice: 'en', nome: 'English', breve: 'EN' },
];

export const PREDEFINITA = 'it';

/* ------------------------------------------------------------ dizionari */

const DIZIONARI = {

  it: {
    'app.nome': 'Black Spider',
    'app.sottotitolo': 'Conversazioni dirette fra browser, senza server.',

    'voce.chat': 'Chat',
    'voce.persone': 'Persone',
    'voce.archivio': 'Archivio',
    'voce.app': 'App',
    'voce.impostazioni': 'Impostazioni',

    'barra.sezioni': 'Sezioni',
    'barra.apri': 'Apri il menu',
    'barra.chiudi': 'Chiudi il menu',
    'barra.comprimi': 'Comprimi il menu',
    'barra.espandi': 'Espandi il menu',
    'tema.titolo': 'Tema',
    'tema.auto': 'Auto',
    'tema.chiaro': 'Chiaro',
    'tema.scuro': 'Scuro',
    'lingua.titolo': 'Lingua',

    'testata.identita': 'La tua identità',
    'testata.senzaNome': 'senza nome',
    'comune.nessuno': 'nessuno',
    'comune.link': 'link',
    'comune.codice': 'codice',

    /* --- collegamento --- */
    'collega.titolo': 'Collega qualcuno',
    'collega.spiega': 'Non c\'è nessun server: per parlare bisogna prima scambiarsi un codice. Mandalo con qualunque mezzo — WhatsApp, email, un messaggio.',
    'collega.invita': 'Invita',
    'collega.stun': 'Prova anche attraverso internet',
    'collega.stunSpiega': '(usa i server STUN di Google; senza, si resta dentro la rete locale)',
    'collega.crea': 'Crea un invito',
    'collega.mandaLink': 'Manda questo link',
    'collega.copiaLink': 'Copia il link',
    'collega.poiIncolla': 'Poi incolla qui la risposta',
    'collega.segnapostoRisposta': 'Il codice che ti ha rimandato…',
    'collega.completa': 'Completa il collegamento',
    'collega.oppure': 'Oppure rispondi',
    'collega.incollaInvito': 'Incolla l\'invito ricevuto',
    'collega.segnapostoInvito': 'Il link o il codice…',
    'collega.prepara': 'Prepara la risposta',
    'collega.rimanda': 'Rimanda questo codice',
    'collega.copiaCodice': 'Copia il codice',

    /* --- chat --- */
    'stato.nonCollegato': 'non collegato',
    'stato.collegato': 'collegato',
    'stato.instabile': 'connessione instabile',
    'stato.chiuso': 'chiuso',
    'stato.fallito': 'non riuscito',
    'percorso.diretto': 'diretto ({tipo})',
    'percorso.relay': 'via relay ({tipo})',
    'chat.chiudi': 'Chiudi la connessione',
    'chat.segnaposto': 'Scrivi…',
    'chat.invia': 'Invia',
    'chat.vuoto': 'Ancora nessun messaggio. Collega qualcuno e scrivi.',
    'chat.tu': 'tu',
    'registro.titolo': 'Registro',

    /* --- chiamata --- */
    'chiamata.titolo': 'Chiamata',
    'chiamata.chiama': 'Chiama',
    'chiamata.soloVoce': 'solo voce',
    'chiamata.conVideo': 'con video',
    'chiamata.nonCollegato': 'Per chiamare bisogna prima collegarsi a qualcuno.',
    'chiamata.tiChiama': 'ti sta chiamando',
    'chiamata.stoChiamando': 'Sto chiamando {chi}…',
    'chiamata.accetta': 'Accetta',
    'chiamata.rifiuta': 'Rifiuta',
    'chiamata.inCorso': 'In chiamata con',
    'chiamata.muto': 'Muto',
    'chiamata.riparla': 'Togli il muto',
    'chiamata.videoAccendi': 'Accendi la telecamera',
    'chiamata.videoSpegni': 'Spegni la telecamera',
    'chiamata.riattacca': 'Riattacca',
    'chiamata.sconosciuto': 'qualcuno',
    'chiamata.giaInCorso': 'C\'è già una chiamata in corso.',
    'chiamata.microfonoNegato': 'Il microfono non è stato concesso ({errore}): senza microfono non c\'è niente da mandare.',
    'chiamata.telecameraNegata': 'La telecamera non è stata concessa ({errore}).',
    'chiamata.spiega': 'La chiamata è solo voce: costa 24-40 kbps, contro 1,5 Mbps di un video. Il video si accende dopo, se serve.',

    'registro.titolo': 'Registro',

    /* --- persone --- */
    'persone.titolo': 'Persone',
    'persone.spiega': 'Il tuo identificativo è l\'impronta della tua chiave pubblica: non è un nome che qualcuno può assegnarti, e non cambia mai.',
    'persone.tuTitolo': 'Tu',
    'persone.id': 'Identificativo',
    'persone.numero': 'Numero di sicurezza',
    'persone.numeroSpiega': 'Confrontalo a voce con l\'altra persona: se è lo stesso, non c\'è nessuno in mezzo.',
    'persone.nome': 'Il tuo nome',
    'persone.nomeSpiega': 'Lo vedono gli altri. È un evento firmato, non un campo che si può riscrivere al posto tuo.',
    'persone.salvaNome': 'Salva il nome',
    'persone.incontrate': 'Chi hai incontrato',
    'persone.nessunoIncontrato': 'Ancora nessuno. Quando colleghi qualcuno, la sua chiave arriva qui.',
    'persone.scriveAnche': 'ha scritto qui',
    'persone.scriveNonAncora': 'non ha ancora scritto qui',
    'persone.chiScrive': 'Chi scrive in questa stanza',

    /* --- archivio --- */
    'archivio.titolo': 'Archivio',
    'archivio.spiega': 'Il log è la verità: ogni evento è firmato da chi l\'ha scritto e legato al precedente. Quello che vedi nelle altre schermate è solo una sua proiezione.',
    'archivio.totali': 'Eventi',
    'archivio.autori': 'Autori',
    'archivio.stanze': 'Stanze',
    'archivio.colSeq': '#',
    'archivio.colTipo': 'Tipo',
    'archivio.colAutore': 'Autore',
    'archivio.colQuando': 'Quando',
    'archivio.colStanza': 'Stanza',
    'archivio.vuoto': 'L\'archivio è vuoto: non hai ancora scritto né ricevuto niente.',
    'archivio.troncato': 'Mostro gli ultimi {mostrati} eventi su {totale}.',

    /* --- i moduli --- */
    'mod.titolo': 'App',
    'mod.spiega': 'Black Spider non è una chat: è un modo per far parlare due browser direttamente. La chat è la prima applicazione costruita sopra queste fondamenta — le altre si appoggiano agli stessi pezzi, e arrivano una alla volta. I gruppi non sono un\'applicazione a parte: sono la chat con più di due persone.',
    'mod.pronta': 'pronta',
    'mod.inArrivo': 'in arrivo',
    'mod.apri': 'Apri',
    'mod.chat.nome': 'Chat',
    'mod.chat.desc': 'Una stanza, due persone, messaggi firmati che restano nel tuo browser. Con tre o più persone è un gruppo: la sincronizzazione è già simmetrica, non serve un altro protocollo.',
    'mod.chiamate.nome': 'Chiamate',
    'mod.chiamate.desc': 'La stessa connessione che porta i messaggi porta anche la voce: si chiama senza scambiarsi un secondo invito. Solo voce per difetto, il video si accende dopo.',
    'mod.file.nome': 'File',
    'mod.file.desc': 'Mandarsi un file direttamente. Il canale dati già spezza i messaggi lunghi in pezzi, che è la parte difficile.',
    'mod.bacheca.nome': 'Bacheca',
    'mod.bacheca.desc': 'Uno stato condiviso che più persone modificano insieme: un editor semplice, dove quello che conta è che tutti vedano la stessa cosa.',
    'mod.blocchi.nome': 'Blocchi',
    'mod.blocchi.desc': 'Note e liste fatte di pezzi, condivise. È il caso di prova più duro per uno stato che cambia mentre lo si guarda.',

    /* --- impostazioni --- */
    'imp.titolo': 'Impostazioni',
    'imp.aspetto': 'Aspetto',
    'imp.aspettoSpiega': 'Il tema automatico segue le preferenze del sistema operativo.',
    'imp.lingua': 'Lingua',
    'imp.memoria': 'Memoria',
    'imp.persistente': 'Il browser ha concesso la memoria permanente: quello che scrivi non verrà buttato via per fare spazio.',
    'imp.nonPersistente': 'Il browser non ha concesso la memoria permanente: se lo spazio scarseggia potrebbe cancellare l\'archivio. Installare l\'app riduce il rischio.',
    'imp.chiedi': 'Chiedi la memoria permanente',
    'imp.eventi': 'Eventi nell\'archivio',
    'imp.esporta': 'Esporta l\'archivio',
    'imp.esportaSpiega': 'Scarica tutto il log in un file, tuo. Attenzione: esce in chiaro — le firme dicono chi ha scritto, non nascondono cosa.',

    /* --- registro --- */
    'nota.creaStun': 'Creo un invito con STUN…',
    'nota.creaLocale': 'Creo un invito per la rete locale…',
    'nota.raccolta': 'Raccolta ICE: {esito}',
    'nota.invitoPronto': 'Invito pronto: {n} caratteri.',
    'nota.invitoFallito': 'Non sono riuscito a creare l\'invito: {errore}',
    'nota.primaInvito': 'Prima crea un invito.',
    'nota.incollaRisposta': 'Incolla il codice che ti è tornato.',
    'nota.rispostaAccettata': 'Risposta accettata: aspetto che il canale si apra.',
    'nota.rispostaNonValida': 'Risposta non valida: {errore}',
    'nota.incollaInvito': 'Incolla l\'invito che hai ricevuto.',
    'nota.invitoDi': 'Invito di {chi}{stun}.',
    'nota.conStun': ' (con STUN)',
    'nota.soloLocale': ' (solo rete locale)',
    'nota.entroStanza': 'Entro nella stanza {stanza}.',
    'nota.rispostaPronta': 'Risposta pronta: {n} caratteri, rimandala.',
    'nota.invitoNonValido': 'Invito non valido: {errore}',
    'nota.copiato': '{cosa}: copiato.',
    'nota.copiaAMano': '{cosa}: selezionato. Premi Ctrl+C (o ⌘C) per copiarlo.',
    'nota.nonCollegato': 'Non sei collegato a nessuno: il messaggio non partirebbe.',
    'nota.messaggioFallito': 'Il messaggio non è partito: {errore}',
    'nota.chiuso': 'Connessione chiusa.',

    'nota.chiamataArriva': '{chi} ti sta chiamando.',
    'nota.chiamataAccettata': 'Chiamata avviata con {chi}.',
    'nota.chiamataRifiutata': 'Chiamata rifiutata.',
    'nota.chiamataChiusaDa': '{chi} ha riattaccato ({durata}).',
    'nota.chiamataFinita': 'Chiamata finita ({durata}).',
    'nota.chiamataPersa': 'La connessione è caduta: la chiamata è finita.',
    'nota.chiamataAudioBloccato': 'Il browser non ha lasciato partire l\'audio: tocca la pagina per sentire.',
    'nota.chiamataErrore': 'Errore nella chiamata: {errore}',
    'nota.invitoNelLink': 'C\'è un invito in questo link: premi «Prepara la risposta».',
    'nota.identita': 'Identità pronta: {id} ({algoritmo}).',
    'nota.archivio': 'Eventi nell\'archivio: {n}.',
    'nota.memoriaNegata': 'Il browser non ha concesso la memoria permanente: i dati potrebbero essere cancellati se lo spazio scarseggia.',
    'nota.offline': 'Funziona anche senza rete.',
    'nota.swFallito': 'Service worker non registrato: {errore}',
    'nota.avvioFallito': 'Avvio fallito: {errore}',
    'nota.nomeSalvato': 'Nome aggiornato e firmato.',
    'nota.esportato': 'Archivio esportato: {n} eventi.',
    'errore.avvio': 'Avvio fallito: {errore}',

    /* --- trasporto --- */
    'tr.rifiutata': 'La rete ha rifiutato la connessione.',
    'tr.interrotta': 'Connessione interrotta.',
    'tr.canaleChiuso': 'Il canale non è aperto: il messaggio non è partito.',

    /* --- ICE --- */
    'ice.host': 'host',
    'ice.srflx': 'STUN',
    'ice.prflx': 'fra i peer',
    'ice.relay': 'TURN',
    'ice.sconosciuto': 'sconosciuto',
    'ice.host.spiega': 'indirizzo della rete locale, nessun intermediario',
    'ice.srflx.spiega': 'indirizzo pubblico scoperto tramite un server STUN',
    'ice.prflx.spiega': 'indirizzo scoperto parlando con l\'altro',
    'ice.relay.spiega': 'passa da un server TURN: qualcun altro trasporta i messaggi',
    'ice.esito.complete': 'completa',
    'ice.esito.quiete': 'in quiete',
    'ice.esito.timeout': 'scaduta',

    /* --- sincronizzazione --- */
    'sinc.inPari': 'Sei già in pari: non c\'è niente da mandare.',
    'sinc.mandoMancanti': 'Mando all\'altro gli eventi che gli mancano: {n}.',
    'sinc.incontrato': 'Incontrato {chi}.',
    'sinc.respinto': 'Evento respinto da {autore}: {motivo}',
    'sinc.catenaRotta': 'Catena di {autore} non continua: {motivo}',
    'sinc.accettati': 'Eventi accettati: {n} (già noti: {gia}).',
    'sinc.respinti': 'Eventi respinti: {n}.',
    'sinc.inAttesa': 'In attesa della chiave dell\'autore: {n}.',
    'sinc.errore': 'Errore nel protocollo: {errore}',
    'sinc.nonSpedito': 'Evento salvato ma non spedito: {errore}',
  },

  en: {
    'app.nome': 'Black Spider',
    'app.sottotitolo': 'Direct conversations between browsers, with no server.',

    'voce.chat': 'Chat',
    'voce.persone': 'People',
    'voce.archivio': 'Archive',
    'voce.app': 'Apps',
    'voce.impostazioni': 'Settings',

    'barra.sezioni': 'Sections',
    'barra.apri': 'Open the menu',
    'barra.chiudi': 'Close the menu',
    'barra.comprimi': 'Collapse the menu',
    'barra.espandi': 'Expand the menu',
    'tema.titolo': 'Theme',
    'tema.auto': 'Auto',
    'tema.chiaro': 'Light',
    'tema.scuro': 'Dark',
    'lingua.titolo': 'Language',

    'testata.identita': 'Your identity',
    'testata.senzaNome': 'unnamed',
    'comune.nessuno': 'nobody',
    'comune.link': 'link',
    'comune.codice': 'code',

    'collega.titolo': 'Connect someone',
    'collega.spiega': 'There is no server: to talk, the two of you first have to swap a code. Send it any way you like — WhatsApp, email, a text message.',
    'collega.invita': 'Invite',
    'collega.stun': 'Also try over the internet',
    'collega.stunSpiega': '(uses Google\'s STUN servers; without it, you stay inside the local network)',
    'collega.crea': 'Create an invite',
    'collega.mandaLink': 'Send this link',
    'collega.copiaLink': 'Copy the link',
    'collega.poiIncolla': 'Then paste the answer here',
    'collega.segnapostoRisposta': 'The code they sent back…',
    'collega.completa': 'Complete the connection',
    'collega.oppure': 'Or answer one',
    'collega.incollaInvito': 'Paste the invite you received',
    'collega.segnapostoInvito': 'The link or the code…',
    'collega.prepara': 'Prepare the answer',
    'collega.rimanda': 'Send this code back',
    'collega.copiaCodice': 'Copy the code',

    'stato.nonCollegato': 'not connected',
    'stato.collegato': 'connected',
    'stato.instabile': 'connection unstable',
    'stato.chiuso': 'closed',
    'stato.fallito': 'failed',
    'percorso.diretto': 'direct ({tipo})',
    'percorso.relay': 'via relay ({tipo})',
    'chat.chiudi': 'Close the connection',
    'chat.segnaposto': 'Write…',
    'chat.invia': 'Send',
    'chat.vuoto': 'No messages yet. Connect someone and write.',
    'chat.tu': 'you',
    'registro.titolo': 'Log',

    /* --- call --- */
    'chiamata.titolo': 'Call',
    'chiamata.chiama': 'Call',
    'chiamata.soloVoce': 'voice only',
    'chiamata.conVideo': 'with video',
    'chiamata.nonCollegato': 'To call someone you have to be connected first.',
    'chiamata.tiChiama': 'is calling you',
    'chiamata.stoChiamando': 'Calling {chi}…',
    'chiamata.accetta': 'Accept',
    'chiamata.rifiuta': 'Decline',
    'chiamata.inCorso': 'In a call with',
    'chiamata.muto': 'Mute',
    'chiamata.riparla': 'Unmute',
    'chiamata.videoAccendi': 'Turn the camera on',
    'chiamata.videoSpegni': 'Turn the camera off',
    'chiamata.riattacca': 'Hang up',
    'chiamata.sconosciuto': 'someone',
    'chiamata.giaInCorso': 'There is already a call in progress.',
    'chiamata.microfonoNegato': 'The microphone was not granted ({errore}): without it there is nothing to send.',
    'chiamata.telecameraNegata': 'The camera was not granted ({errore}).',
    'chiamata.spiega': 'The call is voice only: it costs 24-40 kbps, against 1.5 Mbps for video. Video goes on afterwards, if needed.',

    'registro.titolo': 'Log',

    'persone.titolo': 'People',
    'persone.spiega': 'Your identifier is the fingerprint of your public key: it is not a name somebody can assign you, and it never changes.',
    'persone.tuTitolo': 'You',
    'persone.id': 'Identifier',
    'persone.numero': 'Security number',
    'persone.numeroSpiega': 'Read it out loud to the other person: if it matches, there is nobody in the middle.',
    'persone.nome': 'Your name',
    'persone.nomeSpiega': 'Other people see it. It is a signed event, not a field someone can rewrite for you.',
    'persone.salvaNome': 'Save the name',
    'persone.incontrate': 'People you have met',
    'persone.nessunoIncontrato': 'Nobody yet. When you connect someone, their key lands here.',
    'persone.scriveAnche': 'has written here',
    'persone.scriveNonAncora': 'has not written here yet',
    'persone.chiScrive': 'Who writes in this room',

    'archivio.titolo': 'Archive',
    'archivio.spiega': 'The log is the truth: every event is signed by whoever wrote it and chained to the one before. What you see on the other screens is only a projection of it.',
    'archivio.totali': 'Events',
    'archivio.autori': 'Authors',
    'archivio.stanze': 'Rooms',
    'archivio.colSeq': '#',
    'archivio.colTipo': 'Type',
    'archivio.colAutore': 'Author',
    'archivio.colQuando': 'When',
    'archivio.colStanza': 'Room',
    'archivio.vuoto': 'The archive is empty: you have neither written nor received anything yet.',
    'archivio.troncato': 'Showing the last {mostrati} events out of {totale}.',

    'mod.titolo': 'Apps',
    'mod.spiega': 'Black Spider is not a chat app: it is a way to make two browsers talk directly. The chat is the first application built on these foundations — the others lean on the same pieces, and arrive one at a time. Groups are not a separate app: they are the chat with more than two people.',
    'mod.pronta': 'ready',
    'mod.inArrivo': 'coming',
    'mod.apri': 'Open',
    'mod.chat.nome': 'Chat',
    'mod.chat.desc': 'One room, two people, signed messages that stay in your browser. With three or more it is a group: synchronisation is already symmetric, no second protocol needed.',
    'mod.chiamate.nome': 'Calls',
    'mod.chiamate.desc': 'The same connection that carries the messages carries the voice too: you call without exchanging a second invite. Voice only by default, video goes on afterwards.',
    'mod.file.nome': 'Files',
    'mod.file.desc': 'Send a file straight across. The data channel already splits long messages into pieces, which is the hard part.',
    'mod.bacheca.nome': 'Board',
    'mod.bacheca.desc': 'Shared state several people edit together: a simple editor, where what matters is that everyone sees the same thing.',
    'mod.blocchi.nome': 'Blocks',
    'mod.blocchi.desc': 'Notes and lists made of pieces, shared. The hardest test case for state that changes while you look at it.',

    'imp.titolo': 'Settings',
    'imp.aspetto': 'Appearance',
    'imp.aspettoSpiega': 'The automatic theme follows your operating system.',
    'imp.lingua': 'Language',
    'imp.memoria': 'Storage',
    'imp.persistente': 'The browser granted persistent storage: what you write will not be evicted to free up space.',
    'imp.nonPersistente': 'The browser did not grant persistent storage: if space runs short it may delete the archive. Installing the app reduces the risk.',
    'imp.chiedi': 'Ask for persistent storage',
    'imp.eventi': 'Events in the archive',
    'imp.esporta': 'Export the archive',
    'imp.esportaSpiega': 'Download the whole log as a file of your own. Careful: it comes out in the clear — signatures say who wrote something, they do not hide what.',

    'nota.creaStun': 'Creating an invite with STUN…',
    'nota.creaLocale': 'Creating an invite for the local network…',
    'nota.raccolta': 'ICE gathering: {esito}',
    'nota.invitoPronto': 'Invite ready: {n} characters.',
    'nota.invitoFallito': 'I could not create the invite: {errore}',
    'nota.primaInvito': 'Create an invite first.',
    'nota.incollaRisposta': 'Paste the code they sent back.',
    'nota.rispostaAccettata': 'Answer accepted: waiting for the channel to open.',
    'nota.rispostaNonValida': 'Invalid answer: {errore}',
    'nota.incollaInvito': 'Paste the invite you received.',
    'nota.invitoDi': 'Invite from {chi}{stun}.',
    'nota.conStun': ' (with STUN)',
    'nota.soloLocale': ' (local network only)',
    'nota.entroStanza': 'Joining room {stanza}.',
    'nota.rispostaPronta': 'Answer ready: {n} characters, send it back.',
    'nota.invitoNonValido': 'Invalid invite: {errore}',
    'nota.copiato': '{cosa}: copied.',
    'nota.copiaAMano': '{cosa}: selected. Press Ctrl+C (or ⌘C) to copy it.',
    'nota.nonCollegato': 'You are not connected to anyone: the message would go nowhere.',
    'nota.messaggioFallito': 'The message did not go out: {errore}',
    'nota.chiuso': 'Connection closed.',

    'nota.chiamataArriva': '{chi} is calling you.',
    'nota.chiamataAccettata': 'Call started with {chi}.',
    'nota.chiamataRifiutata': 'Call declined.',
    'nota.chiamataChiusaDa': '{chi} hung up ({durata}).',
    'nota.chiamataFinita': 'Call ended ({durata}).',
    'nota.chiamataPersa': 'The connection dropped: the call is over.',
    'nota.chiamataAudioBloccato': 'The browser would not start the audio: tap the page to hear.',
    'nota.chiamataErrore': 'Call error: {errore}',
    'nota.invitoNelLink': 'There is an invite in this link: press «Prepare the answer».',
    'nota.identita': 'Identity ready: {id} ({algoritmo}).',
    'nota.archivio': 'Events in the archive: {n}.',
    'nota.memoriaNegata': 'The browser did not grant persistent storage: your data could be evicted if space runs short.',
    'nota.offline': 'It works with no network too.',
    'nota.swFallito': 'Service worker not registered: {errore}',
    'nota.avvioFallito': 'Startup failed: {errore}',
    'nota.nomeSalvato': 'Name updated and signed.',
    'nota.esportato': 'Archive exported: {n} events.',
    'errore.avvio': 'Startup failed: {errore}',

    'tr.rifiutata': 'The network refused the connection.',
    'tr.interrotta': 'Connection interrupted.',
    'tr.canaleChiuso': 'The channel is not open: the message did not go out.',

    'ice.host': 'host',
    'ice.srflx': 'STUN',
    'ice.prflx': 'peer-to-peer',
    'ice.relay': 'TURN',
    'ice.sconosciuto': 'unknown',
    'ice.host.spiega': 'an address on the local network, no intermediary',
    'ice.srflx.spiega': 'a public address discovered through a STUN server',
    'ice.prflx.spiega': 'an address discovered by talking to the other peer',
    'ice.relay.spiega': 'it goes through a TURN server: somebody else carries the messages',
    'ice.esito.complete': 'complete',
    'ice.esito.quiete': 'settled',
    'ice.esito.timeout': 'timed out',

    'sinc.inPari': 'You are already up to date: there is nothing to send.',
    'sinc.mandoMancanti': 'Sending the events they are missing: {n}.',
    'sinc.incontrato': 'Met {chi}.',
    'sinc.respinto': 'Event rejected from {autore}: {motivo}',
    'sinc.catenaRotta': 'Chain of {autore} is not continuous: {motivo}',
    'sinc.accettati': 'Events accepted: {n} (already known: {gia}).',
    'sinc.respinti': 'Events rejected: {n}.',
    'sinc.inAttesa': 'Waiting for the author\'s key: {n}.',
    'sinc.errore': 'Protocol error: {errore}',
    'sinc.nonSpedito': 'Event stored but not sent: {errore}',
  },
};

/* --------------------------------------------------------------- stato */

let corrente = PREDEFINITA;

export function lingue() { return LINGUE; }

export function lingua() { return corrente; }

export function esiste(codice) {
  return Object.prototype.hasOwnProperty.call(DIZIONARI, codice);
}

/** Imposta la lingua corrente. Torna quella che è stata davvero impostata. */
export function imposta(codice) {
  if (esiste(codice)) corrente = codice;
  if (typeof document !== 'undefined') document.documentElement.lang = corrente;
  return corrente;
}

/**
 * La traduzione di una chiave, con i segnaposto riempiti.
 *
 * Se la chiave manca si mostra la chiave stessa: un difetto visibile e
 * localizzabile in un secondo, invece di una frase vuota che sembra un'altra
 * cosa.
 */
export function t(chiave, valori) {
  const dizionario = DIZIONARI[corrente] || DIZIONARI[PREDEFINITA];
  let testo = dizionario[chiave];
  if (testo === undefined) testo = DIZIONARI[PREDEFINITA][chiave];
  if (testo === undefined) return chiave;
  if (valori) {
    for (const k of Object.keys(valori)) {
      testo = testo.split('{' + k + '}').join(valori[k]);
    }
  }
  return testo;
}

/* ------------------------------------------------- applicazione alla pagina */

const ATTRIBUTI = [
  ['data-i18n', 'textContent'],
  ['data-i18n-titolo', 'title'],
  ['data-i18n-segnaposto', 'placeholder'],
  ['data-i18n-aria', 'ariaLabel'],
];

/** Riscrive tutti i testi marcati dentro `radice`. */
export function applica(radice = document) {
  for (const [attributo, proprieta] of ATTRIBUTI) {
    for (const elemento of radice.querySelectorAll('[' + attributo + ']')) {
      elemento[proprieta] = t(elemento.getAttribute(attributo));
    }
  }
}
