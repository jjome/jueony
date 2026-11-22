using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal static class WorkspaceCheckpointWebView
{
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length != 7) return 2;
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        int exitCode = 1;
        using (var form = new Form { Width = 1440, Height = 960, Opacity = 0, ShowInTaskbar = false })
        using (var webView = new WebView2 { Dock = DockStyle.Fill })
        using (var deadline = new Timer { Interval = 60000 })
        using (var terminate = new Timer { Interval = 100 })
        {
            form.Controls.Add(webView);
            deadline.Tick += delegate { Console.Error.WriteLine("WebView2 recovery probe timed out."); form.Close(); };
            form.Shown += async delegate
            {
                deadline.Start();
                try
                {
                    var origin = new Uri(args[2]);
                    var options = new CoreWebView2EnvironmentOptions("--no-first-run --disable-background-networking");
                    var environment = await CoreWebView2Environment.CreateAsync(args[0], args[1], options);
                    if (!String.Equals(Path.GetFullPath(environment.UserDataFolder).TrimEnd('\\'), Path.GetFullPath(args[1]).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase))
                        throw new Exception("WebView did not use its isolated test profile.");
                    await webView.EnsureCoreWebView2Async(environment);
                    var core = webView.CoreWebView2;
                    int externalRequests = 0;
                    core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All, CoreWebView2WebResourceRequestSourceKinds.All);
                    core.WebResourceRequested += (sender, e) =>
                    {
                        var uri = new Uri(e.Request.Uri);
                        if ((uri.Scheme == "http" || uri.Scheme == "https") && uri.GetLeftPart(UriPartial.Authority) != origin.GetLeftPart(UriPartial.Authority))
                        {
                            externalRequests++;
                            e.Response = environment.CreateWebResourceResponse(null, 403, "Forbidden", "");
                        }
                    };
                    await core.AddScriptToExecuteOnDocumentCreatedAsync(File.ReadAllText(args[3]));
                    terminate.Tick += delegate
                    {
                        if (!File.Exists(args[5] + ".terminate")) return;
                        terminate.Stop();
                        try
                        {
                            var pid = checked((int)core.BrowserProcessId);
                            using (var process = Process.GetProcessById(pid))
                            {
                                string expectedRuntime = Path.GetFullPath(args[0]).TrimEnd('\\') + "\\";
                                string executable = process.MainModule.FileName;
                                if (!executable.StartsWith(expectedRuntime, StringComparison.OrdinalIgnoreCase)) throw new Exception("Browser is outside the isolated WebView runtime.");
                                process.Kill();
                                if (!process.WaitForExit(5000)) throw new Exception("Owned WebView process did not exit.");
                                File.WriteAllText(args[5] + ".terminated", "{\"pid\":" + pid + ",\"exited\":true}");
                            }
                        }
                        catch (Exception error) { exitCode = 1; Console.Error.WriteLine(error); }
                        finally { form.Close(); }
                    };
                    core.WebMessageReceived += (sender, e) =>
                    {
                        if (new Uri(e.Source).GetLeftPart(UriPartial.Authority) != origin.GetLeftPart(UriPartial.Authority)) return;
                        if (File.Exists(args[5])) return;
                        string result = "{\"webView2\":\"" + environment.BrowserVersionString + "\",\"externalRequests\":" + externalRequests + ",\"probe\":" + e.TryGetWebMessageAsString() + "}";
                        File.WriteAllText(args[5] + ".tmp", result);
                        File.Move(args[5] + ".tmp", args[5]);
                        exitCode = 0;
                        if (args[6] == "hold") terminate.Start();
                        else form.Close();
                    };
                    core.NavigationCompleted += async (sender, e) =>
                    {
                        if (!e.IsSuccess) { Console.Error.WriteLine(e.WebErrorStatus); form.Close(); return; }
                        await core.ExecuteScriptAsync(File.ReadAllText(args[4]));
                    };
                    webView.Source = origin;
                }
                catch (Exception error) { Console.Error.WriteLine(error); form.Close(); }
            };
            Application.Run(form);
        }
        return exitCode;
    }
}
