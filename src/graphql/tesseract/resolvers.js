import { log, print } from 'io.maana.shared'

import { gql } from 'apollo-server-express'
import pubsub from '../../pubsub'
import uuid from 'uuid'

import { createWorker } from 'tesseract.js'

import { PDFImage } from 'pdf-image'
import http from 'http'
import fs from 'fs'
import path from 'path'

require('dotenv').config()

const SERVICE_ID = process.env.SERVICE_ID
const SELF = SERVICE_ID || 'io.maana.template'
const download = (url, dest) => {
  return new Promise((resolve, reject) => {
    var file = fs.createWriteStream(dest)
    http
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
      const pdfPath = await download(
        file.id,
        path.resolve(__dirname, `./pdf/${uuid()}.pdf`)
      )

      var pdfImage = new PDFImage(pdfPath, {
        convertOptions: {
          '-alpha': 'off',
          '-density': 300
        }
      })
      var imagePaths = await pdfImage.convertFile()

      // fs.unlink(pdfPath)
      const text = await Promise.all(
        imagePaths.map(async path => extractTextFromImageFile(path))
      )

      fs.readdir(path.resolve(__dirname, `./pdf/`), (err, files) => {
        if (err) throw err

        for (const file of files) {
          fs.unlink(path.join(path.resolve(__dirname, `./pdf/`), file), err => {
            if (err) throw err
          })
        }
      })

      return text.join(' ')
    }
  }
}
