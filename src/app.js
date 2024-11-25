import { Client } from'whatsapp-web.js'
import qrcode from 'qrcode-terminal'
import express from'express'
import bodyParser from'body-parser'
import cors from'cors'

const encuestas = {};

const preguntas = [
    '¿Cómo califica su experiencia general con el servicio prestado por el taller? (Puntuar del 1 al 10)',
    '¿Cómo fue el trato por parte del personal? (Puntuar del 1 al 10)',
    '¿Cómo califica la calidad del servicio realizado al vehículo? (Puntuar del 1 al 10)',
    '¿Cómo califica la puntualidad de la entrega? (Puntuar del 1 al 10)'
];

const app = express();

app.use(cors());

app.use(bodyParser.json());

const client = new Client();

client.on('qr', (qr) => {

    qrcode.generate(qr, { small: true });

});

client.on('ready', () => {

    console.log('WhatsApp Web Client is ready!');

});

const iniciarEncuesta = async (numero) => {

    const wid = `549${numero}@c.us`;

    encuestas[wid] = { paso: 0, respuestas: [], esperandoComentario: false};

    try {

        await client.sendMessage(wid, '¡Gracias por elegirnos y por contribuir a la mejora continua de nuestro concesionario oficial Toyota! Este cuestionario tiene como objetivo evaluar la efectividad de nuestros servicios y reparaciones. Su opinión es muy valiosa para identificar oportunidades de mejora y ofrecer un servicio cada vez más excelente. ¿Le gustaría participar en esta encuesta? Por favor, responda con "sí" o "no".');

    } catch (error) {

        console.error(`Error al iniciar la encuesta con ${numero}:`, error);

    }
};

app.post('/enviar-encuesta', async (req, res) => {

    const { numeros } = req.body;

    if (!numeros || numeros.length === 0) {

        return res.status(400).json({ error: 'Se requiere una lista de números.' });
    }

    try {

        for (const numero of numeros) {

            await iniciarEncuesta(numero);

        }

        res.status(200).json({ mensaje: 'Encuestas enviadas correctamente' });

    } catch (error) {

        console.error('Error al enviar las encuestas:', error);

        res.status(500).json({ error: 'Error al enviar las encuestas' });

    }
});

client.on('message', async (message) => {

    const wid = message.from;

    const texto = message.body.trim().toLowerCase();

    if (!encuestas[wid]) return;

    const encuesta = encuestas[wid];

    const paso = encuesta.paso;

    if (paso === 0) {

        if (texto === 'sí' || texto === 'si') {

            encuesta.paso++;

            await client.sendMessage(wid, preguntas[0]);

        } else if (texto === 'no') {

            await client.sendMessage(wid, 'Gracias por su tiempo, ¡hasta la próxima!');

            delete encuestas[wid];

        } else {

            await client.sendMessage(wid, 'Por favor responde con "sí" o "no".');

        }
    }

    else if (paso > 0 && paso <= preguntas.length) {

        const respuesta = parseInt(texto);

        if (!isNaN(respuesta) && respuesta >= 1 && respuesta <= 10) {

            encuesta.respuestas.push(respuesta);

            encuesta.paso++;

            if (encuesta.paso <= preguntas.length) {

                await client.sendMessage(wid, preguntas[encuesta.paso - 1]);

            } else {

                await client.sendMessage(wid, '¿Desea dejarnos un comentario adicional? Responde con "sí" o "no".');

                encuesta.esperandoComentario = true;
            }
        } else {

            await client.sendMessage(wid, 'Por favor, ingrese un valor válido entre 1 y 10.');

        }
    }
  
    else if (encuesta.esperandoComentario) {

        if (texto === 'sí' || texto === 'si') {

            await client.sendMessage(wid, 'Puede dejarnos su comentario ahora.');

            encuesta.esperandoComentario = false; 

            encuesta.esperandoTextoComentario = true; 

        } else if (texto === 'no') {

            await client.sendMessage(wid, 'Gracias por realizar la encuesta. ¡Que tenga un buen día!');

            delete encuestas[wid];

        } else {

            await client.sendMessage(wid, 'Por favor responde con "sí" o "no".');
        }
    }

    else if (encuesta.esperandoTextoComentario) {

        encuesta.comentario = message.body; 

        await client.sendMessage(wid, 'Gracias por su comentario. ¡Que tenga un buen día!');

        delete encuestas[wid]; 
    }

    console.log({ encuesta });
});


client.initialize();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor Express escuchando en el puerto ${PORT}`);
});