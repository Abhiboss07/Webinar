import Layout from "../components/Layout.jsx";
import MediaLibrary from "../components/MediaLibrary.jsx";

export default function Media() {
  return (
    <Layout title="Media Library">
      <MediaLibrary mode="manage" />
    </Layout>
  );
}
