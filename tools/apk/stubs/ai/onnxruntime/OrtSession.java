package ai.onnxruntime;
public class OrtSession implements AutoCloseable {
 public java.util.Set<String> getInputNames() throws OrtException { return null; }
 public OnnxModelMetadata getMetadata() throws OrtException { return null; }
 public Result run(java.util.Map<String, ? extends OnnxTensorLike> in) throws OrtException { return null; }
 public void close() throws OrtException { }
 public static class Result implements AutoCloseable, Iterable<java.util.Map.Entry<String, OnnxValue>> {
  public OnnxValue get(int i) { return null; }
  public void close() { }
  public java.util.Iterator<java.util.Map.Entry<String, OnnxValue>> iterator() { return null; }
 }
 public static class SessionOptions implements AutoCloseable {
  public enum OptLevel { NO_OPT, BASIC_OPT, EXTENDED_OPT, ALL_OPT }
  public void setIntraOpNumThreads(int n) throws OrtException { }
  public void setOptimizationLevel(OptLevel l) throws OrtException { }
  public void close() { }
 }
}
