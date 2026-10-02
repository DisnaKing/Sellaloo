import { Link } from 'react-router';

// BORRADOR: hay que rellenar los datos del titular y revisar el texto con un asesor antes del piloto.
const OWNER = {
  name: '[Nombre o razón social]',
  taxId: '[NIF]',
  address: '[Domicilio]',
  email: '[correo de contacto]',
};

export default function Legal() {
  return (
    <main className="page">
      <h1>Aviso legal y privacidad</h1>

      <h2 id="aviso-legal">Aviso legal</h2>
      <p>
        Sellaloo es un servicio de {OWNER.name}, con NIF {OWNER.taxId} y domicilio en {OWNER.address}. Contacto:{' '}
        {OWNER.email}.
      </p>
      <p>
        Sellaloo permite a los comercios dar sellos a sus clientes y canjearlos por premios. Cada comercio decide sus
        premios y responde de ellos.
      </p>

      <h2 id="privacidad">Política de privacidad</h2>
      <p>
        <strong>Quién trata tus datos.</strong> {OWNER.name} trata los datos de tu cuenta. Los sellos, las visitas y tu
        ficha en cada comercio los trata ese comercio, y Sellaloo lo hace por encargo suyo.
      </p>
      <p>
        <strong>Qué datos.</strong> Tu nombre, tu teléfono o tu correo, tus sellos y premios, y la fecha de cada visita.
      </p>
      <p>
        <strong>Para qué.</strong> Para darte sellos y premios y para que el comercio vea sus clientes. La base legal es
        el contrato que aceptas al darte de alta. No enviamos publicidad ni vendemos datos.
      </p>
      <p>
        <strong>Dónde.</strong> En Google Firebase (Google Ireland Limited), con servidores en la Unión Europea. El
        servicio de inicio de sesión de Google puede tratar datos fuera de la UE con las garantías del RGPD.
      </p>
      <p>
        <strong>Cuánto tiempo.</strong> Hasta que borres tu cuenta. Al borrarla, los comercios conservan los sellos y las
        visitas sin tu nombre, tu teléfono ni tu correo.
      </p>
      <p>
        <strong>Tus derechos.</strong> Puedes cambiar tus datos y borrar tu cuenta desde «Mi perfil». Para pedir acceso,
        rectificación, supresión, oposición, limitación o portabilidad, escribe a {OWNER.email}. Si no te atendemos bien,
        puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).
      </p>

      <h2 id="encargo">Contrato de encargo para comercios</h2>
      <p>
        El comercio es el responsable de los datos de sus clientes y Sellaloo es su encargado del tratamiento. Sellaloo
        solo trata esos datos para dar el servicio y según las instrucciones del comercio, con personal obligado a
        confidencialidad y medidas de seguridad adecuadas. Usa a Google Ireland Limited (Firebase) como subencargado.
      </p>
      <p>
        Sellaloo avisará al comercio de cualquier brecha de seguridad sin dilación y le ayudará a atender los derechos de
        sus clientes. Cuando el comercio se dé de baja, Sellaloo borrará sus datos o se los devolverá, como prefiera.
      </p>

      <Link className="link" to="/">Volver</Link>
    </main>
  );
}
