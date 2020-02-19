import { log, print } from 'io.maana.shared'
import { gql } from 'apollo-server-express'
import { createWorker } from 'tesseract.js'
import { PDFImage } from 'pdf-image'
import https from 'https'
import fs from 'fs'
import path from 'path'
import uuid from 'uuid'

require('dotenv').config()

const SERVICE_ID = process.env.SERVICE_ID
const SELF = SERVICE_ID || 'io.maana.template'
const download = (url, dest) => {
  return new Promise((resolve, reject) => {
    var file = fs.createWriteStream(dest)
    https
      .get(url, function(response) {
        response.pipe(file)
        file.on('finish', function() {
          file.close(resolve(dest)) // close() is async, call cb after close completes.
        })
      })
      .on('error', function(err) {
        // Handle errors
        fs.unlink(dest) // Delete the file async. (But we don't check the result)
        reject(err.message)
      })
  })
}

const extractTextFromImageFile = async path => {
  const worker = createWorker()
  await worker.load()
  await worker.loadLanguage('eng')
  await worker.initialize('eng')
  const {
    data: { text }
  } = await worker.recognize(path)

  await worker.terminate()
  console.log(text)
  return text
}

export const resolver = {
  Query: {
    info: async (_, args, { client }) => {
      let remoteId = SERVICE_ID

      try {
        if (client) {
          const query = gql`
            query info {
              info {
                id
              }
            }
          `
          const {
            data: {
              info: { id }
            }
          } = await client.query({ query })
          remoteId = id
        }
      } catch (e) {
        log(SELF).error(
          `Info Resolver failed with Exception: ${e.message}\n${print.external(
            e.stack
          )}`
        )
      }

      return {
        id: SERVICE_ID,
        name: 'io.maana.template',
        description: `Maana Q Knowledge Service template using ${remoteId}`
      }
    },
    extractTextFromImageFile: async (_, { file }, { client }) => {
      return extractTextFromImageFile(file.id)
    },
    extractTextFromPdf: async (_, { file }, { client }) => {
      const dir = path.join(__dirname, `./pdf/`)
      const pdfPath = await download(file.id, `${dir}/${uuid()}.pdf`)

      const pdfImage = new PDFImage(pdfPath, {
        convertOptions: {
          '-alpha': 'off',
          '-density': 300
        }
      })
      const imagePaths = await pdfImage.convertFile()

      const text = await Promise.all(
        imagePaths.map(async path => extractTextFromImageFile(path))
      )

      fs.readdir(dir, (err, files) => {
        if (err) throw err

        for (const file of files) {
          fs.unlink(path.join(dir, file), err => {
            if (err) throw err
          })
        }
      })

      return text.join(' ')
    }
  }
}
